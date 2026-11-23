import { useMutation } from '@tanstack/react-query';

import { actualizarIdioma, iniciarSesion } from '@/api/auth';
import { type Idioma, type LoginEntrada } from '@/api/esquemas';
import { useAuth } from '@/app/AuthProvider';
import { guardarCodigoEmpresa } from '@/utils/storage';

export const authKeys = {
  all: ['auth'] as const,
  yo: () => [...authKeys.all, 'yo'] as const,
};

export function useLogin() {
  const { establecerSesion } = useAuth();

  return useMutation({
    mutationFn: (entrada: LoginEntrada) => iniciarSesion(entrada),
    onSuccess: (sesion, variables) => {
      guardarCodigoEmpresa(variables.codigo_empresa);
      establecerSesion(sesion);
    },
  });
}

export function useCambiarIdioma() {
  const { actualizarUsuario } = useAuth();

  return useMutation({
    mutationFn: (idioma: Idioma) => actualizarIdioma(idioma),
    onSuccess: (usuario) => {
      actualizarUsuario(usuario);
    },
  });
}

export function useLogout() {
  const { cerrarSesionActual } = useAuth();

  return useMutation({
    mutationFn: () => cerrarSesionActual(null),
  });
}
