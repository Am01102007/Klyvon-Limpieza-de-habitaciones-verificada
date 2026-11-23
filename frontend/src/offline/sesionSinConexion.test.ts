import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Usuario } from '@/api/esquemas';

import { type EmpleadoRecordado } from './db';

let fila: EmpleadoRecordado | undefined;

/* eslint-disable @typescript-eslint/require-await -- el doble imita la API asíncrona de Dexie */
vi.mock('./db', () => ({
  dbOffline: {
    empleadoRecordado: {
      put: async (nueva: EmpleadoRecordado) => {
        fila = nueva;
      },
      get: async () => fila,
      delete: async () => {
        fila = undefined;
      },
    },
  },
}));
/* eslint-enable @typescript-eslint/require-await */

import { obtenerEmpleadoRecordado, olvidarEmpleado, recordarEmpleado } from './sesionSinConexion';

function usuario(rol: Usuario['rol']): Usuario {
  return {
    id: 'u-1',
    empresa_id: 'e-1',
    nombre_usuario: 'ana',
    tipo_clave: 'pin',
    rol,
    idioma: 'es',
    activo: true,
    creado_en: '2026-11-14T10:00:00Z',
  };
}

describe('entrada sin señal del último empleado', () => {
  beforeEach(() => {
    fila = undefined;
  });

  it('recuerda al empleado y lo olvida al cerrar sesión', async () => {
    await recordarEmpleado(usuario('empleado'));
    expect(await obtenerEmpleadoRecordado()).toMatchObject({ id: 'u-1', rol: 'empleado' });
    await olvidarEmpleado();
    expect(await obtenerEmpleadoRecordado()).toBeNull();
  });

  it('nunca recuerda a supervisores ni administradores', async () => {
    await recordarEmpleado(usuario('empleado'));
    await recordarEmpleado(usuario('supervisor'));
    expect(await obtenerEmpleadoRecordado()).toBeNull();
  });

  it('caduca a las 24 horas sin validar con el servidor', async () => {
    await recordarEmpleado(usuario('empleado'));
    const manana = Date.now() + 25 * 60 * 60 * 1000;
    expect(await obtenerEmpleadoRecordado(manana)).toBeNull();
  });

  it('no guarda ningún token', async () => {
    await recordarEmpleado(usuario('empleado'));
    expect(JSON.stringify(fila)).not.toMatch(/token/i);
  });
});
