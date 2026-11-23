import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  obtenerOperacionesLimpiezaOffline,
  obtenerResumenColaOffline,
  procesarColaOffline,
  reintentarOperacionesConError,
  type ResumenColaOffline,
  suscribirColaOffline,
} from './colaSync';
import { type OperacionCola } from './db';

const claveCola = ['cola-offline'] as const;
// Valores estables: un [] o {} nuevo en cada render dispara efectos que dependen de ellos.
const SIN_OPERACIONES: OperacionCola[] = [];
const RESUMEN_VACIO: ResumenColaOffline = { pendientes: 0, conError: 0, sincronizando: false };

function suscribirRed(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Mantiene las consultas de la cola al día cuando cambia IndexedDB. */
function useInvalidarAlCambiarCola() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      suscribirColaOffline(() => {
        void queryClient.invalidateQueries({ queryKey: claveCola });
      }),
    [queryClient],
  );
}

export function useEstadoRedYCola() {
  const queryClient = useQueryClient();
  const enLinea = useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true,
  );
  useInvalidarAlCambiarCola();

  const resumenQuery = useQuery({
    queryKey: [...claveCola, 'resumen'],
    queryFn: obtenerResumenColaOffline,
    networkMode: 'always',
  });
  const resumen = resumenQuery.data ?? RESUMEN_VACIO;

  const sincronizarAhora = useCallback(async () => {
    const resultado = await procesarColaOffline();
    if (resultado.sincronizadas > 0) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tareas'] }),
        ...resultado.limpiezaIds.map((id) =>
          queryClient.invalidateQueries({ queryKey: ['limpiezas', 'detalle', id] }),
        ),
      ]);
    }
    return resultado;
  }, [queryClient]);

  const reintentarErrores = useCallback(async () => {
    await reintentarOperacionesConError();
    return sincronizarAhora();
  }, [sincronizarAhora]);

  // Sincroniza al montar y cada vez que vuelve la conexión.
  useEffect(() => {
    if (enLinea) {
      void sincronizarAhora();
    }
  }, [enLinea, sincronizarAhora]);

  return { enLinea, ...resumen, sincronizarAhora, reintentarErrores };
}

export function useOperacionesPendientesLimpieza(limpiezaId: string) {
  useInvalidarAlCambiarCola();
  const query = useQuery({
    queryKey: [...claveCola, 'limpieza', limpiezaId],
    queryFn: () => obtenerOperacionesLimpiezaOffline(limpiezaId),
    networkMode: 'always',
  });
  return query.data ?? SIN_OPERACIONES;
}
