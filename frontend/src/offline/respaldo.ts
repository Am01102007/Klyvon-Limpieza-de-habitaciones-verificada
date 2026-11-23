import { type z } from 'zod';

import { esErrorDeRed, obtenerUsuarioCola } from './colaSync';
import { dbOffline } from './db';

/** Las copias de días anteriores no sirven: la lista del empleado es la de hoy. */
const VIGENCIA_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Lee del servidor y guarda una copia en IndexedDB. Sin red, devuelve la última copia de la
 * misma persona (validada otra vez con Zod). Cualquier otro error se propaga tal cual.
 */
export async function conRespaldoLocal<T>(
  clave: string,
  esquema: z.ZodType<T>,
  leer: () => Promise<T>,
): Promise<T> {
  const usuarioId = obtenerUsuarioCola();
  try {
    const datos = await leer();
    if (usuarioId) {
      await guardar(`${usuarioId}:${clave}`, usuarioId, datos);
    }
    return datos;
  } catch (error) {
    if (!usuarioId || !esErrorDeRed(error)) {
      throw error;
    }
    const copia = await leerCopia(`${usuarioId}:${clave}`, usuarioId);
    const valida = esquema.safeParse(copia?.datos);
    if (!copia || !valida.success) {
      throw error;
    }
    return valida.data;
  }
}

async function guardar(clave: string, usuarioId: string, datos: unknown): Promise<void> {
  try {
    const limite = new Date(Date.now() - VIGENCIA_MS).toISOString();
    await dbOffline.respaldos.where('guardadoEn').below(limite).delete();
    await dbOffline.respaldos.put({
      clave,
      usuarioId,
      datos,
      guardadoEn: new Date().toISOString(),
    });
  } catch {
    // Sin IndexedDB (modo privado) la app sigue funcionando en línea.
  }
}

async function leerCopia(clave: string, usuarioId: string) {
  try {
    const copia = await dbOffline.respaldos.get(clave);
    return copia?.usuarioId === usuarioId ? copia : undefined;
  } catch {
    return undefined;
  }
}
