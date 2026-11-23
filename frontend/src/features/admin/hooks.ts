import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { actualizarEmpresa, obtenerEmpresa } from '@/api/empresa';
import { type Idioma, type Rol, type TipoClave } from '@/api/esquemas';
import {
  actualizarHabitacion,
  actualizarPropiedad,
  crearHabitacion,
  crearPropiedad,
  type DatosHabitacion,
  type DatosPropiedad,
  desvincularSupervisor,
  listarHabitaciones,
  listarPropiedades,
  listarSupervisoresPropiedad,
  vincularSupervisor,
} from '@/api/propiedades';
import {
  actualizarUsuario,
  cambiarClaveUsuario,
  crearUsuario,
  listarUsuarios,
} from '@/api/usuarios';

export const adminKeys = {
  all: ['admin'] as const,
  usuarios: (filtros: { rol?: Rol }) => [...adminKeys.all, 'usuarios', filtros] as const,
  propiedades: () => [...adminKeys.all, 'propiedades'] as const,
  supervisores: (propiedadId: string) => [...adminKeys.all, 'supervisores', propiedadId] as const,
  habitaciones: (propiedadId: string) => [...adminKeys.all, 'habitaciones', propiedadId] as const,
  empresa: () => [...adminKeys.all, 'empresa'] as const,
};

/* Usuarios */

export function useUsuarios(filtros: { rol?: Rol } = {}) {
  return useQuery({
    queryKey: adminKeys.usuarios(filtros),
    queryFn: () => listarUsuarios(filtros),
  });
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: crearUsuario,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'usuarios'] });
    },
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      usuarioId: string;
      cambios: { nombre_usuario?: string; rol?: Rol; activo?: boolean; idioma?: Idioma };
    }) => actualizarUsuario(params.usuarioId, params.cambios),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'usuarios'] });
    },
  });
}

export function useCambiarClaveUsuario() {
  return useMutation({
    mutationFn: (params: { usuarioId: string; clave: string; tipo_clave: TipoClave }) =>
      cambiarClaveUsuario(params.usuarioId, { clave: params.clave, tipo_clave: params.tipo_clave }),
  });
}

/* Propiedades y supervisores */

export function usePropiedades() {
  return useQuery({
    queryKey: adminKeys.propiedades(),
    queryFn: () => listarPropiedades(100, 0),
  });
}

export function useCrearPropiedad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: crearPropiedad,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.propiedades() });
    },
  });
}

export function useActualizarPropiedad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { propiedadId: string; cambios: Partial<DatosPropiedad> }) =>
      actualizarPropiedad(params.propiedadId, params.cambios),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.propiedades() });
    },
  });
}

export function useSupervisoresPropiedad(propiedadId: string) {
  return useQuery({
    queryKey: adminKeys.supervisores(propiedadId),
    queryFn: () => listarSupervisoresPropiedad(propiedadId),
    enabled: Boolean(propiedadId),
  });
}

export function useVincularSupervisor(propiedadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => vincularSupervisor(propiedadId, usuarioId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.supervisores(propiedadId) });
    },
  });
}

export function useDesvincularSupervisor(propiedadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => desvincularSupervisor(propiedadId, usuarioId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.supervisores(propiedadId) });
    },
  });
}

/* Habitaciones */

export function useHabitaciones(propiedadId: string) {
  return useQuery({
    queryKey: adminKeys.habitaciones(propiedadId),
    queryFn: () => listarHabitaciones(propiedadId, 100, 0),
    enabled: Boolean(propiedadId),
  });
}

export function useCrearHabitacion(propiedadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entrada: DatosHabitacion) => crearHabitacion(propiedadId, entrada),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.habitaciones(propiedadId) });
    },
  });
}

export function useActualizarHabitacion(propiedadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      habitacionId: string;
      cambios: Partial<DatosHabitacion> & { activa?: boolean };
    }) => actualizarHabitacion(params.habitacionId, params.cambios),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.habitaciones(propiedadId) });
    },
  });
}

/* Empresa */

export function useEmpresa() {
  return useQuery({ queryKey: adminKeys.empresa(), queryFn: obtenerEmpresa });
}

export function useActualizarEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actualizarEmpresa,
    onSuccess: (empresa) => {
      queryClient.setQueryData(adminKeys.empresa(), empresa);
    },
  });
}
