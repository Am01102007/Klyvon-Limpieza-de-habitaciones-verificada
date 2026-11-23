import { type Idioma } from '@/api/esquemas';

const CLAVE_CODIGO_EMPRESA = 'klyvon_codigo_empresa';
const CLAVE_TEMA = 'klyvon_tema';
const CLAVE_TAMANO_FUENTE = 'klyvon_tamano_fuente';
const CLAVE_ALTO_CONTRASTE = 'klyvon_alto_contraste';
const CLAVE_MOVIMIENTO_REDUCIDO = 'klyvon_movimiento_reducido';
const CLAVE_IDIOMA = 'klyvon_idioma';

export type TemaVisual = 'claro' | 'oscuro';
export type TamanoFuente = 'normal' | 'grande' | 'muy_grande';

/**
 * Únicamente se guarda el código de empresa del último login (HU-01)
 * y preferencias anónimas de interfaz/accesibilidad.
 * Nunca almacenar tokens ni datos personales en localStorage.
 */
export function obtenerCodigoEmpresaGuardado(): string {
  try {
    return window.localStorage.getItem(CLAVE_CODIGO_EMPRESA) ?? '';
  } catch {
    return '';
  }
}

export function guardarCodigoEmpresa(codigo: string): void {
  try {
    const limpio = codigo.trim().toUpperCase();
    if (limpio) {
      window.localStorage.setItem(CLAVE_CODIGO_EMPRESA, limpio);
    }
  } catch {
    // Ignorar errores de almacenamiento (modo privado restringido)
  }
}

export function obtenerTemaGuardado(): TemaVisual {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA);
    if (guardado === 'oscuro' || guardado === 'claro') {
      return guardado;
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'oscuro';
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return 'claro';
}

export function guardarTema(tema: TemaVisual): void {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function obtenerTamanoFuenteGuardado(): TamanoFuente {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TAMANO_FUENTE);
    if (guardado === 'normal' || guardado === 'grande' || guardado === 'muy_grande') {
      return guardado;
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return 'normal';
}

export function guardarTamanoFuente(tamano: TamanoFuente): void {
  try {
    window.localStorage.setItem(CLAVE_TAMANO_FUENTE, tamano);
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function obtenerAltoContrasteGuardado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_ALTO_CONTRASTE) === '1';
  } catch {
    return false;
  }
}

export function guardarAltoContraste(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_ALTO_CONTRASTE, activo ? '1' : '0');
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function obtenerMovimientoReducidoGuardado(): boolean {
  try {
    const guardado = window.localStorage.getItem(CLAVE_MOVIMIENTO_REDUCIDO);
    if (guardado === '1') {
      return true;
    }
    if (guardado === '0') {
      return false;
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return true;
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return false;
}

export function guardarMovimientoReducido(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_MOVIMIENTO_REDUCIDO, activo ? '1' : '0');
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function obtenerIdiomaGuardado(): Idioma | null {
  try {
    const guardado = window.localStorage.getItem(CLAVE_IDIOMA);
    if (guardado === 'es' || guardado === 'en' || guardado === 'pt') {
      return guardado;
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return null;
}

export function guardarIdioma(idioma: Idioma): void {
  try {
    window.localStorage.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Ignorar errores de almacenamiento
  }
}

const PREFIJO_PRIVACIDAD = 'klyvon_privacidad_vista_';

/** Solo guarda el id del usuario (no es un dato personal legible) para no repetir el aviso. */
export function avisoPrivacidadVisto(usuarioId: string): boolean {
  try {
    return window.localStorage.getItem(PREFIJO_PRIVACIDAD + usuarioId) === '1';
  } catch {
    return false;
  }
}

export function marcarAvisoPrivacidadVisto(usuarioId: string): void {
  try {
    window.localStorage.setItem(PREFIJO_PRIVACIDAD + usuarioId, '1');
  } catch {
    // Sin almacenamiento el aviso se vuelve a mostrar la próxima vez.
  }
}

const CLAVE_CIERRE_PENDIENTE = 'klyvon_cierre_sesion_pendiente';

/** Un cierre de sesión hecho sin señal no llegó al servidor: se completa al volver la red. */
export function marcarCierrePendiente(pendiente: boolean): void {
  try {
    if (pendiente) {
      window.localStorage.setItem(CLAVE_CIERRE_PENDIENTE, '1');
    } else {
      window.localStorage.removeItem(CLAVE_CIERRE_PENDIENTE);
    }
  } catch {
    // Sin almacenamiento no se puede recordar; el refresh token vence solo.
  }
}

export function hayCierrePendiente(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_CIERRE_PENDIENTE) === '1';
  } catch {
    return false;
  }
}
