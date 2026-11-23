import { construirQuery, solicitar } from './cliente';
import {
  type Asignacion,
  type AsignacionCreada,
  AsignacionCreadaSchema,
  type Pagina,
  PaginaAsignacionesSchema,
  PaginaTareasDelDiaSchema,
  type TareaDelDia,
} from './esquemas';

export async function obtenerTareasHoy(
  limite = 50,
  desplazamiento = 0,
): Promise<Pagina<TareaDelDia>> {
  const query = construirQuery({ limite, desplazamiento });
  return solicitar(`/asignaciones/hoy?${query}`, PaginaTareasDelDiaSchema);
}

export interface FiltrosAsignaciones {
  fecha?: string;
  propiedadId?: string;
  empleadoId?: string;
  limite?: number;
  desplazamiento?: number;
}

export async function listarAsignaciones(
  filtros: FiltrosAsignaciones,
): Promise<Pagina<Asignacion>> {
  const query = construirQuery({
    limite: filtros.limite ?? 50,
    desplazamiento: filtros.desplazamiento ?? 0,
    fecha: filtros.fecha,
    propiedad_id: filtros.propiedadId,
    empleado_id: filtros.empleadoId,
  });
  return solicitar(`/asignaciones?${query}`, PaginaAsignacionesSchema);
}

export interface NuevaAsignacion {
  fecha: string;
  habitacion_id: string;
  empleado_id: string;
  prioridad: number;
  hora_limite: string | null;
}

export async function crearAsignacion(entrada: NuevaAsignacion): Promise<AsignacionCreada> {
  return solicitar('/asignaciones', AsignacionCreadaSchema, {
    metodo: 'POST',
    cuerpoJson: entrada,
  });
}
