import { construirQuery, solicitar, solicitarBlob } from './cliente';
import {
  type DanosPropiedad,
  type Pagina,
  PaginaDanosPropiedadSchema,
  PaginaTiemposEmpleadoSchema,
  PaginaTiemposHabitacionSchema,
  type TiempoEmpleado,
  type TiempoHabitacion,
} from './esquemas';

export type TipoReporte = 'tiempos/habitaciones' | 'tiempos/empleados' | 'danos';

export interface FiltrosReporte {
  desde?: string;
  hasta?: string;
  propiedadId?: string;
  /** Solo aplica a los reportes de tiempos. */
  empleadoId?: string;
  limite?: number;
  desplazamiento?: number;
}

function query(tipo: TipoReporte, filtros: FiltrosReporte, conPaginacion: boolean): string {
  return construirQuery({
    desde: filtros.desde,
    hasta: filtros.hasta,
    propiedad_id: filtros.propiedadId,
    empleado_id: tipo === 'danos' ? undefined : filtros.empleadoId,
    limite: conPaginacion ? (filtros.limite ?? 100) : undefined,
    desplazamiento: conPaginacion ? (filtros.desplazamiento ?? 0) : undefined,
  });
}

export async function obtenerTiemposHabitaciones(
  filtros: FiltrosReporte,
): Promise<Pagina<TiempoHabitacion>> {
  return solicitar(
    `/reportes/tiempos/habitaciones?${query('tiempos/habitaciones', filtros, true)}`,
    PaginaTiemposHabitacionSchema,
  );
}

export async function obtenerTiemposEmpleados(
  filtros: FiltrosReporte,
): Promise<Pagina<TiempoEmpleado>> {
  return solicitar(
    `/reportes/tiempos/empleados?${query('tiempos/empleados', filtros, true)}`,
    PaginaTiemposEmpleadoSchema,
  );
}

export async function obtenerDanosPorPropiedad(
  filtros: FiltrosReporte,
): Promise<Pagina<DanosPropiedad>> {
  return solicitar(`/reportes/danos?${query('danos', filtros, true)}`, PaginaDanosPropiedadSchema);
}

export async function descargarReportePdf(
  tipo: TipoReporte,
  filtros: FiltrosReporte,
): Promise<Blob> {
  return solicitarBlob(`/reportes/${tipo}/pdf?${query(tipo, filtros, false)}`);
}
