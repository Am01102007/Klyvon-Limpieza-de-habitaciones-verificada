import { useQuery } from '@tanstack/react-query';

import { obtenerTareasHoy } from '@/api/asignaciones';
import { PaginaTareasDelDiaSchema } from '@/api/esquemas';
import { conRespaldoLocal } from '@/offline/respaldo';

export const tareasKeys = {
  all: ['tareas'] as const,
  hoy: (limite: number, desplazamiento: number) =>
    [...tareasKeys.all, 'hoy', limite, desplazamiento] as const,
};

export function useTareasHoy(limite = 50, desplazamiento = 0) {
  return useQuery({
    queryKey: tareasKeys.hoy(limite, desplazamiento),
    queryFn: () =>
      conRespaldoLocal(
        `tareas-hoy:${String(limite)}:${String(desplazamiento)}`,
        PaginaTareasDelDiaSchema,
        () => obtenerTareasHoy(limite, desplazamiento),
      ),
    // Corre aunque no haya red: sin señal responde la copia guardada en el teléfono.
    networkMode: 'offlineFirst',
  });
}
