import { describe, expect, it } from 'vitest';

import { calcularSegundosNetosTranscurridos } from './cronometro';

describe('calcularSegundosNetosTranscurridos', () => {
  it('devuelve 0 cuando no hay inicio', () => {
    expect(calcularSegundosNetosTranscurridos(null, [], Date.now())).toBe(0);
  });

  it('prioriza la duración neta fija del servidor cuando está disponible', () => {
    expect(
      calcularSegundosNetosTranscurridos(
        '2026-11-14T10:00:00Z',
        [],
        Date.parse('2026-11-14T11:00:00Z'),
        845,
      ),
    ).toBe(845);
  });

  it('descuenta pausas cerradas y pausas abiertas del total transcurrido', () => {
    const inicio = '2026-11-14T10:00:00Z';
    const ahora = Date.parse('2026-11-14T10:30:00Z');
    const pausas = [
      { inicio: '2026-11-14T10:10:00Z', fin: '2026-11-14T10:15:00Z' },
      { inicio: '2026-11-14T10:25:00Z', fin: null },
    ];

    // 30 min brutos - 5 min cerrada - 5 min abierta = 20 min = 1200 s
    expect(calcularSegundosNetosTranscurridos(inicio, pausas, ahora)).toBe(1200);
  });
});
