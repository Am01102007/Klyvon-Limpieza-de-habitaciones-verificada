import { ErrorApi } from '@/api/cliente';
import { type CategoriaDano, type GravedadDano, type MotivoPausa } from '@/api/esquemas';
import {
  crearPausaLimpieza,
  finalizarLimpieza,
  iniciarLimpieza,
  reanudarPausaLimpieza,
  reportarDanoLimpieza,
  subirFotoLimpieza,
} from '@/api/limpiezas';

import { dbOffline, type OperacionCola } from './db';

export type NuevaOperacionCola =
  | {
      limpiezaId: string;
      tipo: 'iniciar';
      fotoId: string;
      archivo: Blob;
    }
  | {
      limpiezaId: string;
      tipo: 'foto';
      momento: 'entrada' | 'salida';
      fotoId: string;
      archivo: Blob;
    }
  | {
      limpiezaId: string;
      tipo: 'dano';
      danoId: string;
      categoria: CategoriaDano;
      gravedad: GravedadDano;
      nota?: string;
      archivo: Blob;
    }
  | {
      limpiezaId: string;
      tipo: 'pausa_crear';
      pausaId: string;
      motivo: MotivoPausa;
    }
  | {
      limpiezaId: string;
      tipo: 'pausa_reanudar';
    }
  | {
      limpiezaId: string;
      tipo: 'finalizar';
    };

export interface ResumenColaOffline {
  pendientes: number;
  conError: number;
  sincronizando: boolean;
}

const oyentesCola = new Set<() => void>();
/**
 * Dueño de la sesión actual. La cola NUNCA se borra al cerrar sesión o expirar: guarda trabajo
 * real (fotos, tiempos). Cada operación lleva su usuarioId y solo se envía con la sesión de esa
 * misma persona, así otra persona en el mismo teléfono no la envía con su token.
 */
let usuarioActualCola: string | null = null;

export function obtenerUsuarioCola(): string | null {
  return usuarioActualCola;
}

export function establecerUsuarioCola(usuarioId: string | null): void {
  usuarioActualCola = usuarioId;
  notificarOyentesCola();
}

let promesaSyncEnCurso: Promise<{ sincronizadas: number; limpiezaIds: string[] }> | null = null;
let sincronizandoActual = false;

function notificarOyentesCola(): void {
  oyentesCola.forEach((cb) => {
    cb();
  });
}

export function suscribirColaOffline(cb: () => void): () => void {
  oyentesCola.add(cb);
  return () => {
    oyentesCola.delete(cb);
  };
}

export function esErrorDeRed(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  return error instanceof ErrorApi && error.codigo === 'error_red';
}

export async function encolarOperacionOffline(entrada: NuevaOperacionCola): Promise<number> {
  if (!usuarioActualCola) {
    throw new ErrorApi(401, 'no_autenticado');
  }
  const registro: OperacionCola = {
    ...entrada,
    usuarioId: usuarioActualCola,
    uuidOperacion: crypto.randomUUID(),
    creadoEn: new Date().toISOString(),
    estado: 'pendiente',
    intentos: 0,
  };
  const id = await dbOffline.colaOperaciones.add(registro);
  notificarOyentesCola();
  return id ?? 0;
}

export async function obtenerResumenColaOffline(): Promise<ResumenColaOffline> {
  try {
    const todas = (await dbOffline.colaOperaciones.toArray()).filter(
      (op) => op.usuarioId === usuarioActualCola,
    );
    const conError = todas.filter((op) => op.estado === 'error').length;
    return {
      pendientes: todas.length,
      conError,
      sincronizando: sincronizandoActual,
    };
  } catch {
    return { pendientes: 0, conError: 0, sincronizando: false };
  }
}

export async function obtenerOperacionesLimpiezaOffline(
  limpiezaId: string,
): Promise<OperacionCola[]> {
  if (!limpiezaId) {
    return [];
  }
  try {
    return await dbOffline.colaOperaciones.where('limpiezaId').equals(limpiezaId).sortBy('id');
  } catch {
    return [];
  }
}

/** Vuelve a intentar las operaciones que el servidor rechazó (por ejemplo, tras corregir algo). */
export async function reintentarOperacionesConError(): Promise<void> {
  const conError = (await dbOffline.colaOperaciones.toArray()).filter(
    (op) => op.usuarioId === usuarioActualCola && op.estado === 'error',
  );
  for (const op of conError) {
    if (op.id !== undefined) {
      await dbOffline.colaOperaciones.update(op.id, { estado: 'pendiente' });
    }
  }
  notificarOyentesCola();
}

/**
 * El backend es idempotente por foto_id / id de pausa / dano_id, así que un reintento devuelve
 * éxito. La única respuesta que equivale a "ya estaba hecho" es reanudar sin pausa abierta.
 * Cualquier otro rechazo se guarda como error visible: nunca se descarta trabajo en silencio.
 */
function equivaleAExito(op: OperacionCola, error: unknown): boolean {
  return (
    op.tipo === 'pausa_reanudar' &&
    error instanceof ErrorApi &&
    error.codigo === 'sin_pausa_abierta'
  );
}

/** Fallos pasajeros: sin red, sesión vencida, límite de peticiones o error del servidor. */
function esReintentable(error: unknown): boolean {
  if (esErrorDeRed(error)) {
    return true;
  }
  return (
    error instanceof ErrorApi &&
    (error.estado === 401 || error.estado === 429 || error.estado >= 500)
  );
}

async function ejecutarOperacionIndividual(op: OperacionCola): Promise<void> {
  switch (op.tipo) {
    case 'iniciar':
      await iniciarLimpieza({
        limpiezaId: op.limpiezaId,
        archivo: op.archivo,
        fotoId: op.fotoId,
      });
      return;
    case 'foto':
      await subirFotoLimpieza({
        limpiezaId: op.limpiezaId,
        momento: op.momento,
        archivo: op.archivo,
        fotoId: op.fotoId,
      });
      return;
    case 'dano':
      await reportarDanoLimpieza({
        limpiezaId: op.limpiezaId,
        categoria: op.categoria,
        gravedad: op.gravedad,
        archivo: op.archivo,
        nota: op.nota,
        danoId: op.danoId,
      });
      return;
    case 'pausa_crear':
      await crearPausaLimpieza({
        limpiezaId: op.limpiezaId,
        motivo: op.motivo,
        id: op.pausaId,
      });
      return;
    case 'pausa_reanudar':
      await reanudarPausaLimpieza(op.limpiezaId);
      return;
    case 'finalizar':
      await finalizarLimpieza(op.limpiezaId);
      return;
  }
}

export async function procesarColaOffline(): Promise<{
  sincronizadas: number;
  limpiezaIds: string[];
}> {
  if (promesaSyncEnCurso) {
    return promesaSyncEnCurso;
  }
  const usuarioId = usuarioActualCola;
  if (!usuarioId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { sincronizadas: 0, limpiezaIds: [] };
  }

  promesaSyncEnCurso = (async () => {
    sincronizandoActual = true;
    notificarOyentesCola();
    let sincronizadas = 0;
    const limpiezasAfectadas = new Set<string>();
    // Si una operación de una limpieza falla, las siguientes de esa limpieza esperan (orden FIFO).
    const limpiezasDetenidas = new Set<string>();

    try {
      const operaciones = await dbOffline.colaOperaciones.orderBy('id').toArray();
      for (const op of operaciones) {
        if (op.id === undefined || op.usuarioId !== usuarioId) {
          continue;
        }
        if (op.estado === 'error' || limpiezasDetenidas.has(op.limpiezaId)) {
          limpiezasDetenidas.add(op.limpiezaId);
          continue;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }

        await dbOffline.colaOperaciones.update(op.id, { estado: 'sincronizando' });
        notificarOyentesCola();

        try {
          await ejecutarOperacionIndividual(op);
          await dbOffline.colaOperaciones.delete(op.id);
          sincronizadas += 1;
          limpiezasAfectadas.add(op.limpiezaId);
        } catch (err) {
          if (equivaleAExito(op, err)) {
            await dbOffline.colaOperaciones.delete(op.id);
            sincronizadas += 1;
            limpiezasAfectadas.add(op.limpiezaId);
            continue;
          }

          if (esReintentable(err)) {
            await dbOffline.colaOperaciones.update(op.id, {
              estado: 'pendiente',
              intentos: op.intentos + 1,
            });
            break;
          }

          const codigo = err instanceof ErrorApi ? err.codigo : 'desconocido';
          await dbOffline.colaOperaciones.update(op.id, {
            estado: 'error',
            intentos: op.intentos + 1,
            ultimoError: codigo,
          });
          limpiezasDetenidas.add(op.limpiezaId);
        }
      }
    } finally {
      sincronizandoActual = false;
      notificarOyentesCola();
      promesaSyncEnCurso = null;
    }

    return {
      sincronizadas,
      limpiezaIds: Array.from(limpiezasAfectadas),
    };
  })();

  return promesaSyncEnCurso;
}
