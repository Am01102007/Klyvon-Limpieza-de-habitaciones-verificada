import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Usuario } from '@/api/esquemas';
import * as AuthModule from '@/app/AuthProvider';

import { ModalAvisoPrivacidadEmpleado } from './AvisoPrivacidad';

function simularUsuario(rol: Usuario['rol']) {
  vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
    usuario: {
      id: `u-${rol}`,
      empresa_id: 'e-1',
      nombre_usuario: 'ana',
      tipo_clave: 'pin',
      rol,
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
}

describe('Aviso de privacidad (RNF-07)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('se muestra una vez al empleado y no vuelve tras aceptarlo', () => {
    simularUsuario('empleado');
    const { unmount } = render(<ModalAvisoPrivacidadEmpleado />);
    expect(screen.getByRole('dialog')).toHaveTextContent('la app no usa GPS');
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    render(<ModalAvisoPrivacidadEmpleado />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no interrumpe al supervisor', () => {
    simularUsuario('supervisor');
    render(<ModalAvisoPrivacidadEmpleado />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
