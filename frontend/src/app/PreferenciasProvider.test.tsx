import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PreferenciasProvider, usePreferencias } from './PreferenciasProvider';

function PanelPruebaPreferencias() {
  const {
    tema,
    tamanoFuente,
    altoContraste,
    movimientoReducido,
    alternarTema,
    establecerTamanoFuente,
    establecerAltoContraste,
    establecerMovimientoReducido,
    restablecerPreferencias,
  } = usePreferencias();

  return (
    <div>
      <span data-testid="estado">
        {tema}|{tamanoFuente}|{String(altoContraste)}|{String(movimientoReducido)}
      </span>
      <button type="button" onClick={alternarTema}>
        tema
      </button>
      <button
        type="button"
        onClick={() => {
          establecerTamanoFuente('grande');
        }}
      >
        fuente-grande
      </button>
      <button
        type="button"
        onClick={() => {
          establecerAltoContraste(true);
        }}
      >
        contraste
      </button>
      <button
        type="button"
        onClick={() => {
          establecerMovimientoReducido(true);
        }}
      >
        movimiento
      </button>
      <button type="button" onClick={restablecerPreferencias}>
        restablecer
      </button>
    </div>
  );
}

describe('PreferenciasProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('aplica tema oscuro, tamaño de fuente, alto contraste y restablece preferencias', () => {
    render(
      <PreferenciasProvider>
        <PanelPruebaPreferencias />
      </PreferenciasProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'tema' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'fuente-grande' }));
    expect(document.documentElement.classList.contains('klyvon-fuente-grande')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'contraste' }));
    expect(document.documentElement.classList.contains('klyvon-alto-contraste')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'movimiento' }));
    expect(document.documentElement.classList.contains('klyvon-sin-animacion')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'restablecer' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('klyvon-fuente-normal')).toBe(true);
    expect(document.documentElement.classList.contains('klyvon-alto-contraste')).toBe(false);
  });
});
