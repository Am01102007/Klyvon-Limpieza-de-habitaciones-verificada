import { Navigate, Outlet } from 'react-router';

import { useAuth } from '../AuthProvider';

export function RequireAuth() {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
