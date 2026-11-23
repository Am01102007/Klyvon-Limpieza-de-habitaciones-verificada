import { createBrowserRouter, Navigate } from 'react-router';

import { EmpresaPage } from '@/features/admin/EmpresaPage';
import { PropiedadesPage } from '@/features/admin/PropiedadesPage';
import { UsuariosPage } from '@/features/admin/UsuariosPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { PerfilPage } from '@/features/auth/PerfilPage';
import { FlujoLimpiezaPage } from '@/features/limpieza/FlujoLimpiezaPage';
import { AsignacionesPage } from '@/features/supervisor/AsignacionesPage';
import { DanosPage } from '@/features/supervisor/DanosPage';
import { DetalleRevisionPage } from '@/features/supervisor/DetalleRevisionPage';
import { ReportesPage } from '@/features/supervisor/ReportesPage';
import { RevisionesPage } from '@/features/supervisor/RevisionesPage';
import { TareasHoyPage } from '@/features/tareas/TareasHoyPage';

import { rutaInicialPorRol, useAuth } from './AuthProvider';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function RedireccionRaiz() {
  const { usuario } = useAuth();
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={rutaInicialPorRol(usuario.rol)} replace />;
}

function LayoutPorRol() {
  const { usuario } = useAuth();
  if (usuario?.rol === 'empleado') {
    return <MobileLayout />;
  }
  return <DesktopLayout />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <RedireccionRaiz />,
      },
      {
        path: '/empleado',
        element: <RequireRole rolesPermitidos={['empleado']} />,
        children: [
          {
            element: <MobileLayout />,
            children: [
              { index: true, element: <TareasHoyPage /> },
              { path: 'limpiezas/:limpiezaId', element: <FlujoLimpiezaPage /> },
            ],
          },
        ],
      },
      {
        path: '/supervisor',
        element: <RequireRole rolesPermitidos={['supervisor', 'admin']} />,
        children: [
          {
            element: <DesktopLayout />,
            children: [
              { index: true, element: <RevisionesPage /> },
              { path: 'revisiones/:limpiezaId', element: <DetalleRevisionPage /> },
              { path: 'asignaciones', element: <AsignacionesPage /> },
              { path: 'danos', element: <DanosPage /> },
              { path: 'reportes', element: <ReportesPage /> },
              { path: 'empleados', element: <UsuariosPage /> },
            ],
          },
        ],
      },
      {
        path: '/admin',
        element: <RequireRole rolesPermitidos={['admin']} />,
        children: [
          {
            element: <DesktopLayout />,
            children: [
              { index: true, element: <RevisionesPage /> },
              { path: 'revisiones/:limpiezaId', element: <DetalleRevisionPage /> },
              { path: 'asignaciones', element: <AsignacionesPage /> },
              { path: 'danos', element: <DanosPage /> },
              { path: 'reportes', element: <ReportesPage /> },
              { path: 'usuarios', element: <UsuariosPage /> },
              { path: 'propiedades', element: <PropiedadesPage /> },
              { path: 'empresa', element: <EmpresaPage /> },
            ],
          },
        ],
      },
      {
        path: '/perfil',
        element: <LayoutPorRol />,
        children: [{ index: true, element: <PerfilPage /> }],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
