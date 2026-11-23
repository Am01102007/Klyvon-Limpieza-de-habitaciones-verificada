import { type z } from 'zod';

import {
  type CampoError,
  ErrorApiBodySchema,
  type SesionSalida,
  SesionSalidaSchema,
} from './esquemas';

const URL_BASE_API = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const NOMBRE_CANAL_AUTH = 'klyvon_auth_sync';
const NOMBRE_LOCK_REFRESH = 'klyvon_refresh_lock';

type MensajeCanalAuth =
  { tipo: 'sesion_cerrada' } | { tipo: 'sesion_renovada'; sesion: SesionSalida };

export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly campos?: CampoError[];

  constructor(estado: number, codigo: string, campos?: CampoError[]) {
    super(codigo);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.campos = campos;
  }
}

let tokenEnMemoria: string | null = null;
let promesaRefreshEnCurso: Promise<SesionSalida | null> | null = null;
const oyentesExpiracion = new Set<() => void>();
const oyentesRenovacion = new Set<(sesion: SesionSalida) => void>();

let canalAuth: BroadcastChannel | null = null;

function obtenerCanalAuth(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!canalAuth) {
    canalAuth = new BroadcastChannel(NOMBRE_CANAL_AUTH);
    canalAuth.addEventListener('message', (evento: MessageEvent<unknown>) => {
      const datos = evento.data;
      if (typeof datos !== 'object' || datos === null || !('tipo' in datos)) {
        return;
      }
      const msg = datos as MensajeCanalAuth;
      if (msg.tipo === 'sesion_cerrada') {
        tokenEnMemoria = null;
        oyentesExpiracion.forEach((cb) => {
          cb();
        });
      } else {
        const parsed = SesionSalidaSchema.safeParse(msg.sesion);
        if (parsed.success) {
          tokenEnMemoria = parsed.data.access_token;
          oyentesRenovacion.forEach((cb) => {
            cb(parsed.data);
          });
        }
      }
    });
  }
  return canalAuth;
}

obtenerCanalAuth();

export function establecerTokenMemoria(token: string | null): void {
  tokenEnMemoria = token;
}

export function limpiarTokenMemoria(): void {
  tokenEnMemoria = null;
}

export function suscribirExpiracionSesion(cb: () => void): () => void {
  oyentesExpiracion.add(cb);
  return () => {
    oyentesExpiracion.delete(cb);
  };
}

export function suscribirRenovacionSesion(cb: (sesion: SesionSalida) => void): () => void {
  oyentesRenovacion.add(cb);
  return () => {
    oyentesRenovacion.delete(cb);
  };
}

export function difundirCierreSesion(): void {
  limpiarTokenMemoria();
  obtenerCanalAuth()?.postMessage({ tipo: 'sesion_cerrada' } satisfies MensajeCanalAuth);
}

function notificarExpiracionTotal(): void {
  difundirCierreSesion();
  oyentesExpiracion.forEach((cb) => {
    cb();
  });
}

function construirUrl(ruta: string): string {
  const rutaNormalizada = ruta.startsWith('/') ? ruta : `/${ruta}`;
  return `${URL_BASE_API}${rutaNormalizada}`;
}

async function parsearJsonSeguro(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (!texto) {
    return null;
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

async function construirErrorDesdeRespuesta(respuesta: Response): Promise<ErrorApi> {
  const cuerpo = await parsearJsonSeguro(respuesta);
  const parsed = ErrorApiBodySchema.safeParse(cuerpo);
  if (parsed.success) {
    return new ErrorApi(respuesta.status, parsed.data.codigo, parsed.data.campos);
  }
  if (respuesta.status === 503) {
    return new ErrorApi(503, 'servicio_no_disponible');
  }
  if (respuesta.status === 413) {
    return new ErrorApi(413, 'archivo_demasiado_grande');
  }
  if (respuesta.status === 429) {
    return new ErrorApi(429, 'demasiadas_peticiones');
  }
  return new ErrorApi(respuesta.status, respuesta.status >= 500 ? 'error_interno' : 'desconocido');
}

async function ejecutarRefreshPuro(): Promise<SesionSalida | null> {
  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    throw new ErrorApi(0, 'error_red');
  }

  if (!respuesta.ok) {
    limpiarTokenMemoria();
    return null;
  }

  const json = await parsearJsonSeguro(respuesta);
  const parsed = SesionSalidaSchema.safeParse(json);
  if (!parsed.success) {
    limpiarTokenMemoria();
    return null;
  }

  tokenEnMemoria = parsed.data.access_token;
  obtenerCanalAuth()?.postMessage({
    tipo: 'sesion_renovada',
    sesion: parsed.data,
  } satisfies MensajeCanalAuth);
  oyentesRenovacion.forEach((cb) => {
    cb(parsed.data);
  });
  return parsed.data;
}

export async function renovarSesion(): Promise<SesionSalida | null> {
  if (promesaRefreshEnCurso) {
    return promesaRefreshEnCurso;
  }

  const ejecutarConLock = async (): Promise<SesionSalida | null> => {
    const locks =
      typeof navigator !== 'undefined' ? (navigator.locks as LockManager | undefined) : undefined;
    if (locks && typeof locks.request === 'function') {
      let resultado: SesionSalida | null = null;
      await locks.request(NOMBRE_LOCK_REFRESH, async () => {
        resultado = await ejecutarRefreshPuro();
      });
      return resultado;
    }
    return ejecutarRefreshPuro();
  };

  promesaRefreshEnCurso = ejecutarConLock().finally(() => {
    promesaRefreshEnCurso = null;
  });

  return promesaRefreshEnCurso;
}

export interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpoJson?: unknown;
  cuerpoFormData?: FormData;
  requiereAuth?: boolean;
  permitirRefresh?: boolean;
  signal?: AbortSignal;
}

async function ejecutarFetchInterno(
  ruta: string,
  opciones: OpcionesPeticion,
  yaReintentado: boolean,
): Promise<Response> {
  const {
    metodo = 'GET',
    cuerpoJson,
    cuerpoFormData,
    requiereAuth = true,
    permitirRefresh = true,
    signal,
  } = opciones;

  const headers = new Headers();
  let body: BodyInit | undefined;

  if (cuerpoFormData !== undefined) {
    body = cuerpoFormData;
  } else if (cuerpoJson !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(cuerpoJson);
  }

  if (requiereAuth && tokenEnMemoria) {
    headers.set('Authorization', `Bearer ${tokenEnMemoria}`);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta), {
      method: metodo,
      headers,
      body,
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ErrorApi(0, 'error_red');
  }

  if (respuesta.ok) {
    return respuesta;
  }

  const errorApi = await construirErrorDesdeRespuesta(respuesta);

  if (
    respuesta.status === 401 &&
    errorApi.codigo === 'no_autenticado' &&
    permitirRefresh &&
    !yaReintentado
  ) {
    let sesionRenovada: SesionSalida | null;
    try {
      sesionRenovada = await renovarSesion();
    } catch {
      throw errorApi;
    }

    if (!sesionRenovada) {
      notificarExpiracionTotal();
      throw errorApi;
    }

    return ejecutarFetchInterno(ruta, opciones, true);
  }

  throw errorApi;
}

export async function solicitar<T>(
  ruta: string,
  esquema: z.ZodType<T>,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const respuesta = await ejecutarFetchInterno(ruta, opciones, false);
  const json = await parsearJsonSeguro(respuesta);
  const parsed = esquema.safeParse(json);
  if (!parsed.success) {
    throw new ErrorApi(500, 'respuesta_invalida');
  }
  return parsed.data;
}

export async function solicitarVacio(ruta: string, opciones: OpcionesPeticion = {}): Promise<void> {
  await ejecutarFetchInterno(ruta, opciones, false);
}

/** Descarga binaria (PDF de reportes) con el mismo manejo de sesión y errores. */
export async function solicitarBlob(ruta: string, opciones: OpcionesPeticion = {}): Promise<Blob> {
  const respuesta = await ejecutarFetchInterno(ruta, opciones, false);
  return respuesta.blob();
}

/** Arma la query string omitiendo valores vacíos. */
export function construirQuery(valores: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== '') {
      params.set(clave, String(valor));
    }
  }
  return params.toString();
}
