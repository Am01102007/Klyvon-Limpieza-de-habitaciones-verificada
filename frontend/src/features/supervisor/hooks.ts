import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { crearAsignacion, type FiltrosAsignaciones, listarAsignaciones } from '@/api/asignaciones';
import { cambiarEstadoDano, type FiltrosDanos, listarDanos, obtenerDano } from '@/api/danos';
import { type EstadoDano, type LimpiezaResumen } from '@/api/esquemas';
import { listarHabitaciones, listarPropiedades } from '@/api/propiedades';
import {
  descargarReportePdf,
  type FiltrosReporte,
  obtenerDanosPorPropiedad,
  obtenerTiemposEmpleados,
  obtenerTiemposHabitaciones,
  type TipoReporte,
} from '@/api/reportes';
import { type FiltrosLimpiezas, listarLimpiezas, revisarLimpieza } from '@/api/revisiones';
import { listarUsuarios } from '@/api/usuarios';
import { limpiezasKeys } from '@/features/limpieza/hooks';

export const supervisorKeys = {
  all: ['supervisor'] as const,
  limpiezas: (filtros: FiltrosLimpiezas) => [...supervisorKeys.all, 'limpiezas', filtros] as const,
  asignaciones: (filtros: FiltrosAsignaciones) =>
    [...supervisorKeys.all, 'asignaciones', filtros] as const,
  danos: (filtros: FiltrosDanos) => [...supervisorKeys.all, 'danos', filtros] as const,
  dano: (danoId: string) => [...supervisorKeys.all, 'dano', danoId] as const,
  reporte: (tipo: TipoReporte, filtros: FiltrosReporte) =>
    [...supervisorKeys.all, 'reporte', tipo, filtros] as const,
  propiedades: () => [...supervisorKeys.all, 'propiedades'] as const,
  habitaciones: (propiedadId: string) =>
    [...supervisorKeys.all, 'habitaciones', propiedadId] as const,
  empleados: () => [...supervisorKeys.all, 'empleados'] as const,
  usuarios: () => [...supervisorKeys.all, 'usuarios'] as const,
};

/* Catálogos para filtros y formularios (el backend ya limita al alcance del supervisor). */

export function usePropiedadesCatalogo() {
  return useQuery({
    queryKey: supervisorKeys.propiedades(),
    queryFn: () => listarPropiedades(100, 0),
    staleTime: 5 * 60_000,
  });
}

export function useHabitacionesCatalogo(propiedadId: string) {
  return useQuery({
    queryKey: supervisorKeys.habitaciones(propiedadId),
    queryFn: () => listarHabitaciones(propiedadId, 100, 0),
    enabled: Boolean(propiedadId),
    staleTime: 5 * 60_000,
  });
}

export function useEmpleadosCatalogo() {
  return useQuery({
    queryKey: supervisorKeys.empleados(),
    queryFn: () => listarUsuarios({ rol: 'empleado', limite: 100 }),
    staleTime: 5 * 60_000,
  });
}

/** Todos los roles: para mostrar quién cambió el estado de un daño. */
export function useUsuariosCatalogo() {
  return useQuery({
    queryKey: supervisorKeys.usuarios(),
    queryFn: () => listarUsuarios({ limite: 100 }),
    staleTime: 5 * 60_000,
  });
}

/* Revisión */

export function useLimpiezas(filtros: FiltrosLimpiezas) {
  return useQuery({
    queryKey: supervisorKeys.limpiezas(filtros),
    queryFn: () => listarLimpiezas(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useRevisarLimpieza(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { resultado: 'aprobada' | 'rechazada'; comentario?: string }) =>
      revisarLimpieza({ limpiezaId, ...params }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) }),
        queryClient.invalidateQueries({ queryKey: supervisorKeys.all }),
      ]);
    },
  });
}

/* Asignaciones (el backend no permite borrar asignaciones) */

export function useAsignaciones(filtros: FiltrosAsignaciones) {
  return useQuery({
    queryKey: supervisorKeys.asignaciones(filtros),
    queryFn: () => listarAsignaciones(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useCrearAsignacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: crearAsignacion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...supervisorKeys.all, 'asignaciones'] });
    },
  });
}

/**
 * Estado de las limpiezas de un día, para mostrarlo junto a cada asignación (el listado de
 * asignaciones no lo trae). Si hay corrección, manda la corrección.
 */
export function useEstadoLimpiezasDelDia(filtros: FiltrosAsignaciones) {
  const fecha = filtros.fecha ?? '';
  const query = useQuery({
    queryKey: [...supervisorKeys.all, 'limpiezas-del-dia', filtros] as const,
    queryFn: () =>
      listarLimpiezas({
        desde: fecha,
        hasta: fecha,
        propiedadId: filtros.propiedadId,
        empleadoId: filtros.empleadoId,
        limite: 100,
      }),
    enabled: Boolean(fecha),
  });
  const porAsignacion = new Map<string, LimpiezaResumen>();
  for (const limpieza of query.data?.items ?? []) {
    const actual = porAsignacion.get(limpieza.asignacion_id);
    if (!actual || limpieza.tipo === 'correccion') {
      porAsignacion.set(limpieza.asignacion_id, limpieza);
    }
  }
  return porAsignacion;
}

/* Daños */

export function useDanos(filtros: FiltrosDanos) {
  return useQuery({
    queryKey: supervisorKeys.danos(filtros),
    queryFn: () => listarDanos(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useDetalleDano(danoId: string | null) {
  return useQuery({
    queryKey: supervisorKeys.dano(danoId ?? ''),
    queryFn: () => obtenerDano(danoId ?? ''),
    enabled: Boolean(danoId),
  });
}

export function useCambiarEstadoDano() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { danoId: string; estado: EstadoDano }) =>
      cambiarEstadoDano(params.danoId, params.estado),
    onSuccess: async (detalle) => {
      queryClient.setQueryData(supervisorKeys.dano(detalle.dano.id), detalle);
      await queryClient.invalidateQueries({ queryKey: [...supervisorKeys.all, 'danos'] });
    },
  });
}

/* Reportes */

export function useReporteTiemposHabitaciones(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: supervisorKeys.reporte('tiempos/habitaciones', filtros),
    queryFn: () => obtenerTiemposHabitaciones(filtros),
  });
}

export function useReporteTiemposEmpleados(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: supervisorKeys.reporte('tiempos/empleados', filtros),
    queryFn: () => obtenerTiemposEmpleados(filtros),
  });
}

export function useReporteDanos(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: supervisorKeys.reporte('danos', filtros),
    queryFn: () => obtenerDanosPorPropiedad(filtros),
  });
}

export function useDescargarReportePdf() {
  return useMutation({
    mutationFn: (params: { tipo: TipoReporte; filtros: FiltrosReporte }) =>
      descargarReportePdf(params.tipo, params.filtros),
  });
}
