import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type DetalleLimpieza, type TareaDelDia } from '@/api/esquemas';
import * as apiLimpiezas from '@/api/limpiezas';

import { FlujoLimpiezaPage } from './FlujoLimpiezaPage';

function renderConRuta(detalle: DetalleLimpieza, tarea?: TareaDelDia) {
  vi.spyOn(apiLimpiezas, 'obtenerDetalleLimpieza').mockResolvedValue(detalle);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/empleado/limpiezas/${detalle.limpieza.id}`,
            state: tarea ? { tarea } : undefined,
          },
        ]}
      >
        <Routes>
          <Route path="/empleado/limpiezas/:limpiezaId" element={<FlujoLimpiezaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FlujoLimpiezaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deshabilita Continuar cuando faltan fotos de entrada mínimas y no renderiza input file', async () => {
    const detalle: DetalleLimpieza = {
      limpieza: {
        id: 'limp-1',
        asignacion_id: 'asig-1',
        empleado_id: 'emp-1',
        tipo: 'normal',
        limpieza_origen_id: null,
        inicio: null,
        fin: null,
        duracion_neta_seg: null,
        estado_trabajo: 'pendiente',
        requiere_revision: true,
        estado_revision: 'pendiente',
      },
      habitacion_nombre: '101',
      fecha: '2026-11-14',
      fotos: [],
      pausas: [],
      danos: [],
      revision: null,
    };

    const { container } = renderConRuta(detalle);

    const botonContinuar = await screen.findByRole('button', { name: 'Continuar' });
    expect(botonContinuar).toBeDisabled();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('habilita el paso 1. Entrada y Continuar al cumplir el mínimo de fotos de entrada', async () => {
    const detalle: DetalleLimpieza = {
      limpieza: {
        id: 'limp-2',
        asignacion_id: 'asig-2',
        empleado_id: 'emp-1',
        tipo: 'normal',
        limpieza_origen_id: null,
        inicio: '2026-11-14T10:00:00Z',
        fin: null,
        duracion_neta_seg: null,
        estado_trabajo: 'en_curso',
        requiere_revision: true,
        estado_revision: 'pendiente',
      },
      habitacion_nombre: '102',
      fecha: '2026-11-14',
      fotos: [
        {
          id: 'f-1',
          limpieza_id: 'limp-2',
          dano_id: null,
          momento: 'entrada',
          url: '/fotos/f-1.jpg',
          tomada_en: '2026-11-14T10:00:00Z',
          tamano_kb: 120,
        },
      ],
      pausas: [],
      danos: [],
      revision: null,
    };

    renderConRuta(detalle);

    const pasoEntrada = await screen.findByRole('button', { name: '1. Entrada' });
    expect(pasoEntrada).toBeEnabled();
  });
});
