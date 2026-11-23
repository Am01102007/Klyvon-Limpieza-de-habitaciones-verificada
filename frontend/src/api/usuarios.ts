import { construirQuery, solicitar, solicitarVacio } from './cliente';
import {
  type Idioma,
  type Pagina,
  PaginaUsuariosSchema,
  type Rol,
  type TipoClave,
  type Usuario,
  UsuarioSchema,
} from './esquemas';

export async function listarUsuarios(
  filtros: { rol?: Rol; limite?: number; desplazamiento?: number } = {},
): Promise<Pagina<Usuario>> {
  const query = construirQuery({
    limite: filtros.limite ?? 100,
    desplazamiento: filtros.desplazamiento ?? 0,
    rol: filtros.rol,
  });
  return solicitar(`/usuarios?${query}`, PaginaUsuariosSchema);
}

export async function obtenerUsuario(usuarioId: string): Promise<Usuario> {
  return solicitar(`/usuarios/${encodeURIComponent(usuarioId)}`, UsuarioSchema);
}

export async function crearUsuario(entrada: {
  nombre_usuario: string;
  rol: Rol;
  tipo_clave: TipoClave;
  clave: string;
  idioma: Idioma;
}): Promise<Usuario> {
  return solicitar('/usuarios', UsuarioSchema, { metodo: 'POST', cuerpoJson: entrada });
}

/** El backend rechaza `clave` aquí (422): la clave se cambia con `cambiarClaveUsuario`. */
export async function actualizarUsuario(
  usuarioId: string,
  cambios: { nombre_usuario?: string; rol?: Rol; activo?: boolean; idioma?: Idioma },
): Promise<Usuario> {
  return solicitar(`/usuarios/${encodeURIComponent(usuarioId)}`, UsuarioSchema, {
    metodo: 'PATCH',
    cuerpoJson: cambios,
  });
}

export async function cambiarClaveUsuario(
  usuarioId: string,
  entrada: { clave: string; tipo_clave: TipoClave },
): Promise<void> {
  return solicitarVacio(`/usuarios/${encodeURIComponent(usuarioId)}/clave`, {
    metodo: 'POST',
    cuerpoJson: entrada,
  });
}
