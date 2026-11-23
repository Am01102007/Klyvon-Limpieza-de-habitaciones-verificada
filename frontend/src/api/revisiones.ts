import { construirQuery, solicitar } from './cliente';
import {
  type EstadoRevision,
  type LimpiezaResumen,
  type Pagina,
  PaginaLimpiezasSchema,
  type Revision,
  RevisionSchema,
} from './esquemas';

export interface FiltrosLimpiezas {
  estadoRevision?: EstadoRevision;
  propiedadId?: string;
  empleadoId?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  desplazamiento?: number;
}

export async function listarLimpiezas(filtros: FiltrosLimpiezas): Promise<Pagina<LimpiezaResumen>> {
  const query = construirQuery({
    limite: filtros.limite ?? 50,
    desplazamiento: filtros.desplazamiento ?? 0,
    estado_revision: filtros.estadoRevision,
    propiedad_id: filtros.propiedadId,
    empleado_id: filtros.empleadoId,
    desde: filtros.desde,
    hasta: filtros.hasta,
  });
  return solicitar(`/limpiezas?${query}`, PaginaLimpiezasSchema);
}

export async function revisarLimpieza(params: {
  limpiezaId: string;
  resultado: 'aprobada' | 'rechazada';
  comentario?: string;
}): Promise<Revision> {
  const comentario = params.comentario?.trim();
  return solicitar('/revisiones', RevisionSchema, {
    metodo: 'POST',
    cuerpoJson: {
      limpieza_id: params.limpiezaId,
      resultado: params.resultado,
      ...(comentario ? { comentario } : {}),
    },
  });
}
