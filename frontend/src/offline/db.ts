import Dexie, { type EntityTable } from 'dexie';

import { type CategoriaDano, type GravedadDano, type MotivoPausa } from '@/api/esquemas';

export type EstadoOperacionCola = 'pendiente' | 'sincronizando' | 'error';

export type OperacionCola =
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'iniciar';
      fotoId: string;
      archivo: Blob;
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    }
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'foto';
      momento: 'entrada' | 'salida';
      fotoId: string;
      archivo: Blob;
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    }
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'dano';
      danoId: string;
      categoria: CategoriaDano;
      gravedad: GravedadDano;
      nota?: string;
      archivo: Blob;
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    }
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'pausa_crear';
      pausaId: string;
      motivo: MotivoPausa;
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    }
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'pausa_reanudar';
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    }
  | {
      id?: number;
      uuidOperacion: string;
      usuarioId: string;
      limpiezaId: string;
      tipo: 'finalizar';
      creadoEn: string;
      estado: EstadoOperacionCola;
      intentos: number;
      ultimoError?: string;
    };

/** Última copia de una lectura del empleado, para mostrarla sin señal (lista del día, detalle). */
export interface RespaldoLectura {
  clave: string;
  usuarioId: string;
  datos: unknown;
  guardadoEn: string;
}

/** Último empleado con sesión válida en este teléfono, para abrir la app sin señal. */
export interface EmpleadoRecordado {
  id: 'actual';
  usuario: unknown;
  guardadoEn: string;
}

class KlyvonOfflineDB extends Dexie {
  empleadoRecordado!: EntityTable<EmpleadoRecordado, 'id'>;
  colaOperaciones!: EntityTable<OperacionCola, 'id'>;
  respaldos!: EntityTable<RespaldoLectura, 'clave'>;

  constructor() {
    super('klyvon_offline_v1');
    this.version(1).stores({
      colaOperaciones: '++id, uuidOperacion, limpiezaId, tipo, estado, creadoEn',
    });
    // v2: cada operación guarda quién la hizo, para no enviarla con la sesión de otra persona.
    this.version(2).stores({
      colaOperaciones: '++id, uuidOperacion, usuarioId, limpiezaId, tipo, estado, creadoEn',
    });
    // v3: copia local de la lista del día y del detalle de cada limpieza (especificación, capa local).
    this.version(3).stores({
      colaOperaciones: '++id, uuidOperacion, usuarioId, limpiezaId, tipo, estado, creadoEn',
      respaldos: '&clave, usuarioId, guardadoEn',
    });
    // v4: entrada sin señal para el último empleado (decisión del 13 de noviembre).
    this.version(4).stores({
      colaOperaciones: '++id, uuidOperacion, usuarioId, limpiezaId, tipo, estado, creadoEn',
      respaldos: '&clave, usuarioId, guardadoEn',
      empleadoRecordado: '&id',
    });
  }
}

export const dbOffline = new KlyvonOfflineDB();
