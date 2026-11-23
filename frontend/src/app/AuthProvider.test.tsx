import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiAuth from '@/api/auth';
import { ErrorApi } from '@/api/cliente';
import * as sesionSinConexion from '@/offline/sesionSinConexion';

import { AuthProvider, useAuth } from './AuthProvider';

const EMPLEADO = {
  id: 'u-1',
  empresa_id: 'e-1',
  nombre_usuario: 'ana',
  tipo_clave: 'pin' as const,
  rol: 'empleado' as const,
  idioma: 'es' as const,
  activo: true,
  creado_en: '2026-11-14T10:00:00Z',
};

function Estado() {
  const { usuario, sinConexion } = useAuth();
  return <p>{usuario ? `${usuario.nombre_usuario}:${String(sinConexion)}` : 'sin-sesion'}</p>;
}

function montar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Estado />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider: entrada sin señal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    vi.spyOn(sesionSinConexion, 'recordarEmpleado').mockResolvedValue();
    vi.spyOn(sesionSinConexion, 'olvidarEmpleado').mockResolvedValue();
  });

  it('sin red abre como el último empleado, marcado sin conexión', async () => {
    vi.spyOn(apiAuth, 'intentarRecuperarSesion').mockRejectedValue(new ErrorApi(0, 'error_red'));
    vi.spyOn(sesionSinConexion, 'obtenerEmpleadoRecordado').mockResolvedValue(EMPLEADO);
    montar();
    expect(await screen.findByText('ana:true')).toBeInTheDocument();
  });

  it('si el servidor rechaza la sesión, no abre y olvida al empleado', async () => {
    vi.spyOn(apiAuth, 'intentarRecuperarSesion').mockResolvedValue(null);
    const recordado = vi.spyOn(sesionSinConexion, 'obtenerEmpleadoRecordado');
    montar();
    expect(await screen.findByText('sin-sesion')).toBeInTheDocument();
    expect(recordado).not.toHaveBeenCalled();
    expect(sesionSinConexion.olvidarEmpleado).toHaveBeenCalled();
  });

  it('tras cerrar sesión sin señal, no recupera la sesión al abrir', async () => {
    window.localStorage.setItem('klyvon_cierre_sesion_pendiente', '1');
    const recuperar = vi.spyOn(apiAuth, 'intentarRecuperarSesion');
    vi.spyOn(apiAuth, 'cerrarSesion').mockRejectedValue(new ErrorApi(0, 'error_red'));
    montar();
    expect(await screen.findByText('sin-sesion')).toBeInTheDocument();
    expect(recuperar).not.toHaveBeenCalled();
  });
});
