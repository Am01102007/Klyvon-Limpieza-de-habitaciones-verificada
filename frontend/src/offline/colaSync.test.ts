import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorApi } from '@/api/cliente';
import * as apiLimpiezas from '@/api/limpiezas';

import { type OperacionCola } from './db';

const memoriaOps: OperacionCola[] = [];
let siguienteId = 1;

/* eslint-disable @typescript-eslint/require-await -- el doble imita la API asíncrona de Dexie */
vi.mock('./db', () => ({
  dbOffline: {
    colaOperaciones: {
      add: async (op: OperacionCola) => {
        const id = siguienteId++;
        memoriaOps.push({ ...op, id });
        return id;
      },
      toArray: async () => [...memoriaOps],
      orderBy: () => ({
        toArray: async () => [...memoriaOps].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
      }),
      where: () => ({
        equals: (limpiezaId: string) => ({
          sortBy: async () =>
            memoriaOps
              .filter((op) => op.limpiezaId === limpiezaId)
              .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
        }),
      }),
      update: async (id: number, cambios: Partial<OperacionCola>) => {
        const idx = memoriaOps.findIndex((op) => op.id === id);
        const actual = memoriaOps[idx];
        if (idx >= 0 && actual) {
          memoriaOps[idx] = { ...actual, ...cambios } as OperacionCola;
        }
        return 1;
      },
      delete: async (id: number) => {
        const idx = memoriaOps.findIndex((op) => op.id === id);
        if (idx >= 0) {
          memoriaOps.splice(idx, 1);
        }
      },
      clear: async () => {
        memoriaOps.length = 0;
      },
    },
  },
}));

import {
  encolarOperacionOffline,
  establecerUsuarioCola,
  obtenerResumenColaOffline,
  procesarColaOffline,
  reintentarOperacionesConError,
} from './colaSync';

const LIMPIEZA_ENVIADA = {
  id: 'limp-10',
  asignacion_id: 'a-10',
  empleado_id: 'u-1',
  tipo: 'normal' as const,
  limpieza_origen_id: null,
  inicio: '2026-11-14T10:00:00Z',
  fin: '2026-11-14T10:15:00Z',
  duracion_neta_seg: 900,
  estado_trabajo: 'enviada' as const,
  requiere_revision: true,
  estado_revision: 'pendiente' as const,
};

describe('colaSync (CP-21 idempotencia y orden FIFO)', () => {
  beforeEach(() => {
    memoriaOps.length = 0;
    siguienteId = 1;
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    establecerUsuarioCola('u-1');
  });

  it('reintenta con el mismo fotoId tras un error de red y respeta el orden', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    await encolarOperacionOffline({
      limpiezaId: 'limp-10',
      tipo: 'iniciar',
      fotoId: 'uuid-foto-estable',
      archivo: blob,
    });
    await encolarOperacionOffline({ limpiezaId: 'limp-10', tipo: 'finalizar' });

    const spyIniciar = vi
      .spyOn(apiLimpiezas, 'iniciarLimpieza')
      .mockRejectedValueOnce(new ErrorApi(0, 'error_red'))
      .mockResolvedValueOnce({ ...LIMPIEZA_ENVIADA, estado_trabajo: 'en_curso' });
    const spyFinalizar = vi
      .spyOn(apiLimpiezas, 'finalizarLimpieza')
      .mockResolvedValue(LIMPIEZA_ENVIADA);

    const primerIntento = await procesarColaOffline();
    expect(primerIntento.sincronizadas).toBe(0);
    expect(spyFinalizar).not.toHaveBeenCalled();

    const segundoIntento = await procesarColaOffline();
    expect(segundoIntento.sincronizadas).toBe(2);
    expect(spyIniciar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fotoId: 'uuid-foto-estable' }),
    );
    expect(spyFinalizar).toHaveBeenCalledTimes(1);
    expect((await obtenerResumenColaOffline()).pendientes).toBe(0);
  });

  it('no descarta trabajo: un rechazo queda como error y detiene esa limpieza', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    await encolarOperacionOffline({
      limpiezaId: 'limp-10',
      tipo: 'foto',
      momento: 'salida',
      fotoId: 'f-1',
      archivo: blob,
    });
    await encolarOperacionOffline({ limpiezaId: 'limp-10', tipo: 'finalizar' });
    vi.spyOn(apiLimpiezas, 'subirFotoLimpieza').mockRejectedValue(
      new ErrorApi(409, 'pausa_abierta'),
    );
    const spyFinalizar = vi.spyOn(apiLimpiezas, 'finalizarLimpieza');

    await procesarColaOffline();
    expect(spyFinalizar).not.toHaveBeenCalled();
    expect(await obtenerResumenColaOffline()).toMatchObject({ pendientes: 2, conError: 1 });

    await reintentarOperacionesConError();
    expect((await obtenerResumenColaOffline()).conError).toBe(0);
  });

  it('una sesión vencida (401) no marca error: se reintenta después', async () => {
    await encolarOperacionOffline({ limpiezaId: 'limp-10', tipo: 'finalizar' });
    vi.spyOn(apiLimpiezas, 'finalizarLimpieza').mockRejectedValue(
      new ErrorApi(401, 'no_autenticado'),
    );
    await procesarColaOffline();
    expect(await obtenerResumenColaOffline()).toMatchObject({ pendientes: 1, conError: 0 });
  });

  it('conserva la cola al cerrar sesión y no la envía con la sesión de otra persona', async () => {
    await encolarOperacionOffline({ limpiezaId: 'limp-10', tipo: 'finalizar' });
    const spyFinalizar = vi
      .spyOn(apiLimpiezas, 'finalizarLimpieza')
      .mockResolvedValue(LIMPIEZA_ENVIADA);

    establecerUsuarioCola(null);
    await procesarColaOffline();
    establecerUsuarioCola('u-2');
    await procesarColaOffline();
    expect(spyFinalizar).not.toHaveBeenCalled();
    expect((await obtenerResumenColaOffline()).pendientes).toBe(0);

    establecerUsuarioCola('u-1');
    expect((await obtenerResumenColaOffline()).pendientes).toBe(1);
    await procesarColaOffline();
    expect(spyFinalizar).toHaveBeenCalledTimes(1);
  });

  it('no permite encolar sin una sesión', async () => {
    establecerUsuarioCola(null);
    await expect(
      encolarOperacionOffline({ limpiezaId: 'limp-10', tipo: 'finalizar' }),
    ).rejects.toMatchObject({ codigo: 'no_autenticado' });
  });
});
