import { construirQuery, solicitar, solicitarVacio } from './cliente';
import {
  type Habitacion,
  HabitacionSchema,
  type Pagina,
  PaginaHabitacionesSchema,
  PaginaPropiedadesSchema,
  PaginaUsuariosSchema,
  type Propiedad,
  PropiedadSchema,
  type TipoPropiedad,
  type Usuario,
} from './esquemas';

export async function listarPropiedades(
  limite = 100,
  desplazamiento = 0,
): Promise<Pagina<Propiedad>> {
  const query = construirQuery({ limite, desplazamiento });
  return solicitar(`/propiedades?${query}`, PaginaPropiedadesSchema);
}

export interface DatosPropiedad {
  nombre: string;
  tipo: TipoPropiedad;
  direccion: string | null;
  zona_horaria: string;
}

export async function crearPropiedad(entrada: DatosPropiedad): Promise<Propiedad> {
  return solicitar('/propiedades', PropiedadSchema, { metodo: 'POST', cuerpoJson: entrada });
}

export async function actualizarPropiedad(
  propiedadId: string,
  cambios: Partial<DatosPropiedad>,
): Promise<Propiedad> {
  return solicitar(`/propiedades/${encodeURIComponent(propiedadId)}`, PropiedadSchema, {
    metodo: 'PATCH',
    cuerpoJson: cambios,
  });
}

export async function listarSupervisoresPropiedad(propiedadId: string): Promise<Pagina<Usuario>> {
  const query = construirQuery({ limite: 100, desplazamiento: 0 });
  return solicitar(
    `/propiedades/${encodeURIComponent(propiedadId)}/supervisores?${query}`,
    PaginaUsuariosSchema,
  );
}

export async function vincularSupervisor(propiedadId: string, usuarioId: string): Promise<void> {
  return solicitarVacio(`/propiedades/${encodeURIComponent(propiedadId)}/supervisores`, {
    metodo: 'POST',
    cuerpoJson: { usuario_id: usuarioId },
  });
}

export async function desvincularSupervisor(propiedadId: string, usuarioId: string): Promise<void> {
  return solicitarVacio(
    `/propiedades/${encodeURIComponent(propiedadId)}/supervisores/${encodeURIComponent(usuarioId)}`,
    { metodo: 'DELETE' },
  );
}

export async function listarHabitaciones(
  propiedadId: string,
  limite = 100,
  desplazamiento = 0,
): Promise<Pagina<Habitacion>> {
  const query = construirQuery({ limite, desplazamiento });
  return solicitar(
    `/propiedades/${encodeURIComponent(propiedadId)}/habitaciones?${query}`,
    PaginaHabitacionesSchema,
  );
}

export interface DatosHabitacion {
  nombre: string;
  tipo: string | null;
  fotos_min_entrada: number;
  fotos_min_salida: number;
}

export async function crearHabitacion(
  propiedadId: string,
  entrada: DatosHabitacion,
): Promise<Habitacion> {
  return solicitar(
    `/propiedades/${encodeURIComponent(propiedadId)}/habitaciones`,
    HabitacionSchema,
    { metodo: 'POST', cuerpoJson: entrada },
  );
}

export async function actualizarHabitacion(
  habitacionId: string,
  cambios: Partial<DatosHabitacion> & { activa?: boolean },
): Promise<Habitacion> {
  return solicitar(`/habitaciones/${encodeURIComponent(habitacionId)}`, HabitacionSchema, {
    metodo: 'PATCH',
    cuerpoJson: cambios,
  });
}
