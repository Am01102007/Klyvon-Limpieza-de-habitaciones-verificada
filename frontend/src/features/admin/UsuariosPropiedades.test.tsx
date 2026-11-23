import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as apiUsuarios from '@/api/usuarios';
import * as AuthModule from '@/app/AuthProvider';

import { UsuariosPage, validarClave } from './UsuariosPage';

describe('UsuariosPage', () => {
  it('bloquea la desactivación de la propia cuenta del administrador', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      usuario: {
        id: 'admin-1',
        empresa_id: 'emp-1',
        nombre_usuario: 'jefe',
        tipo_clave: 'contrasena',
        rol: 'admin',
        idioma: 'es',
        activo: true,
        creado_en: '2026-11-14T10:00:00Z',
      },
      sinConexion: false,
      cargandoInicial: false,
      motivoCierre: null,
      establecerSesion: vi.fn(),
      actualizarUsuario: vi.fn(),
      cerrarSesionActual: vi.fn(),
      limpiarMotivoCierre: vi.fn(),
    });

    vi.spyOn(apiUsuarios, 'listarUsuarios').mockResolvedValue({
      items: [
        {
          id: 'admin-1',
          empresa_id: 'emp-1',
          nombre_usuario: 'jefe',
          tipo_clave: 'contrasena',
          rol: 'admin',
          idioma: 'es',
          activo: true,
          creado_en: '2026-11-14T10:00:00Z',
        },
        {
          id: 'emp-2',
          empresa_id: 'emp-1',
          nombre_usuario: 'luisa',
          tipo_clave: 'pin',
          rol: 'empleado',
          idioma: 'es',
          activo: true,
          creado_en: '2026-11-14T10:00:00Z',
        },
      ],
      total: 2,
      limite: 100,
      desplazamiento: 0,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <UsuariosPage />
      </QueryClientProvider>,
    );

    const botonesDesactivar = await screen.findAllByRole('button', { name: 'Desactivar' });
    expect(botonesDesactivar[0]).toBeDisabled();
    expect(botonesDesactivar[1]).toBeEnabled();

    expect(screen.getAllByRole('button', { name: 'Restablecer clave' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('valida la clave con las mismas reglas que el backend', () => {
    expect(validarClave('12345', 'contrasena', 'admin')).toBe(
      'usuarios.validacion.contrasena_corta',
    );
    expect(validarClave('123456', 'contrasena', 'admin')).toBeNull();
    expect(validarClave('1234', 'pin', 'empleado')).toBeNull();
    expect(validarClave('1234567', 'pin', 'empleado')).toBe('usuarios.validacion.pin_formato');
    expect(validarClave('1234', 'pin', 'supervisor')).toBe(
      'usuarios.validacion.pin_solo_empleados',
    );
    // Los espacios cuentan: el login no recorta la clave.
    expect(validarClave(' abcde', 'contrasena', 'empleado')).toBeNull();
  });
});
