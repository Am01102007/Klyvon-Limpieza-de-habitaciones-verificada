import { type Usuario, UsuarioSchema } from '@/api/esquemas';

import { dbOffline } from './db';

/** Pasado este tiempo sin validar la sesión con el servidor, hay que volver a entrar con red. */
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

/**
 * Entrada sin señal (solo empleados). Se guarda el perfil público del último empleado con sesión
 * válida; nunca un token. Sin red, la app abre como esa persona para ver su lista y seguir
 * encolando trabajo; nada se envía hasta que el servidor valide la sesión con la cookie.
 */
export async function recordarEmpleado(usuario: Usuario): Promise<void> {
  if (usuario.rol !== 'empleado') {
    await olvidarEmpleado();
    return;
  }
  try {
    await dbOffline.empleadoRecordado.put({
      id: 'actual',
      usuario,
      guardadoEn: new Date().toISOString(),
    });
  } catch {
    // Sin IndexedDB no hay entrada sin señal; la app sigue funcionando con red.
  }
}

export async function olvidarEmpleado(): Promise<void> {
  try {
    await dbOffline.empleadoRecordado.delete('actual');
  } catch {
    // Nada que borrar.
  }
}

export async function obtenerEmpleadoRecordado(ahora = Date.now()): Promise<Usuario | null> {
  try {
    const fila = await dbOffline.empleadoRecordado.get('actual');
    if (!fila || ahora - new Date(fila.guardadoEn).getTime() > VIGENCIA_MS) {
      return null;
    }
    const usuario = UsuarioSchema.safeParse(fila.usuario);
    return usuario.success && usuario.data.rol === 'empleado' && usuario.data.activo
      ? usuario.data
      : null;
  } catch {
    return null;
  }
}
