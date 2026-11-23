import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormularioDano } from './FormularioDano';

describe('FormularioDano', () => {
  it('exige capturar una fotografía antes de guardar y no usa input file', () => {
    const alEnviar = vi.fn();
    const alCancelar = vi.fn();

    const { container } = render(<FormularioDano alEnviar={alEnviar} alCancelar={alCancelar} />);

    expect(container.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar reporte de daño' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Debes capturar una foto del daño.');
    expect(alEnviar).not.toHaveBeenCalled();
  });
});
