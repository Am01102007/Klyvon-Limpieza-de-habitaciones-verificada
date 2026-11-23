import {
  difundirCierreSesion,
  establecerTokenMemoria,
  renovarSesion,
  solicitar,
  solicitarVacio,
} from './cliente';
import {
  type Idioma,
  type LoginEntrada,
  type SesionSalida,
  SesionSalidaSchema,
  type Usuario,
  UsuarioSchema,
} from './esquemas';

export async function iniciarSesion(entrada: LoginEntrada): Promise<SesionSalida> {
  const sesion = await solicitar('/auth/login', SesionSalidaSchema, {
    metodo: 'POST',
    cuerpoJson: {
      codigo_empresa: entrada.codigo_empresa.trim().toUpperCase(),
      nombre_usuario: entrada.nombre_usuario.trim(),
      clave: entrada.clave,
    },
    requiereAuth: false,
    permitirRefresh: false,
  });
  establecerTokenMemoria(sesion.access_token);
  return sesion;
}

export async function intentarRecuperarSesion(): Promise<SesionSalida | null> {
  return renovarSesion();
}

export async function cerrarSesion(): Promise<void> {
  try {
    await solicitarVacio('/auth/logout', {
      metodo: 'POST',
      permitirRefresh: false,
    });
  } finally {
    difundirCierreSesion();
  }
}

export async function obtenerUsuarioActual(): Promise<Usuario> {
  return solicitar('/auth/yo', UsuarioSchema);
}

export async function actualizarIdioma(idioma: Idioma): Promise<Usuario> {
  return solicitar('/auth/yo', UsuarioSchema, {
    metodo: 'PATCH',
    cuerpoJson: { idioma },
  });
}
