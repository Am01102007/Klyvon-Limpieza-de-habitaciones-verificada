import { Navigate, Outlet } from 'react-router';

import { type Rol } from '@/api/esquemas';

import { rutaInicialPorRol, useAuth } from '../AuthProvider';

export function RequireRole({ rolesPermitidos }: { rolesPermitidos: Rol[] }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to={rutaInicialPorRol(usuario.rol)} replace />;
  }

  return <Outlet />;
}
