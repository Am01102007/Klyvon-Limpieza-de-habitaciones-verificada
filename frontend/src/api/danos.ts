import { construirQuery, solicitar } from './cliente';
import {
  type DanoResumen,
  type DetalleDano,
  DetalleDanoSchema,
  type EstadoDano,
  type Pagina,
  PaginaDanosSchema,
} from './esquemas';

export interface FiltrosDanos {
  estado?: EstadoDano;
  propiedadId?: string;
  limite?: number;
  desplazamiento?: number;
}

export async function listarDanos(filtros: FiltrosDanos): Promise<Pagina<DanoResumen>> {
  const query = construirQuery({
    limite: filtros.limite ?? 50,
    desplazamiento: filtros.desplazamiento ?? 0,
    estado: filtros.estado,
    propiedad_id: filtros.propiedadId,
  });
  return solicitar(`/danos?${query}`, PaginaDanosSchema);
}

export async function obtenerDano(danoId: string): Promise<DetalleDano> {
  return solicitar(`/danos/${encodeURIComponent(danoId)}`, DetalleDanoSchema);
}

export async function cambiarEstadoDano(danoId: string, estado: EstadoDano): Promise<DetalleDano> {
  return solicitar(`/danos/${encodeURIComponent(danoId)}/estado`, DetalleDanoSchema, {
    metodo: 'PATCH',
    cuerpoJson: { estado },
  });
}
