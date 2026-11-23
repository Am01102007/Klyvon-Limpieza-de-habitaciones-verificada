import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ErrorApi } from '@/api/cliente';

import { type RespaldoLectura } from './db';

const memoria = new Map<string, RespaldoLectura>();

/* eslint-disable @typescript-eslint/require-await -- el doble imita la API asíncrona de Dexie */
vi.mock('./db', () => ({
  dbOffline: {
    respaldos: {
      put: async (fila: RespaldoLectura) => {
        memoria.set(fila.clave, fila);
      },
      get: async (clave: string) => memoria.get(clave),
      where: () => ({ below: () => ({ delete: async () => 0 }) }),
    },
  },
}));
/* eslint-enable @typescript-eslint/require-await */

import { establecerUsuarioCola } from './colaSync';
import { conRespaldoLocal } from './respaldo';

const Esquema = z.object({ n: z.number() });

describe('respaldo local de lecturas (lista del día sin señal)', () => {
  beforeEach(() => {
    memoria.clear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    establecerUsuarioCola('u-1');
  });

  it('sin red devuelve la última copia de la misma persona', async () => {
    await conRespaldoLocal('tareas', Esquema, () => Promise.resolve({ n: 1 }));
    const sinRed = () => Promise.reject(new ErrorApi(0, 'error_red'));
    await expect(conRespaldoLocal('tareas', Esquema, sinRed)).resolves.toEqual({ n: 1 });
  });

  it('no entrega la copia de otra persona', async () => {
    await conRespaldoLocal('tareas', Esquema, () => Promise.resolve({ n: 1 }));
    establecerUsuarioCola('u-2');
    const sinRed = () => Promise.reject(new ErrorApi(0, 'error_red'));
    await expect(conRespaldoLocal('tareas', Esquema, sinRed)).rejects.toMatchObject({
      codigo: 'error_red',
    });
  });

  it('un error que no es de red (403, 404) no se tapa con la copia', async () => {
    await conRespaldoLocal('tareas', Esquema, () => Promise.resolve({ n: 1 }));
    const prohibido = () => Promise.reject(new ErrorApi(404, 'no_encontrado'));
    await expect(conRespaldoLocal('tareas', Esquema, prohibido)).rejects.toMatchObject({
      codigo: 'no_encontrado',
    });
  });
});
