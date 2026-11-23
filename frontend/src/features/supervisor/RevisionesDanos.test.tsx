import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import * as apiLimpiezas from '@/api/limpiezas';
import * as apiPropiedades from '@/api/propiedades';
import * as apiRevisiones from '@/api/revisiones';

import { DetalleRevisionPage } from './DetalleRevisionPage';
import { RevisionesPage } from './RevisionesPage';

describe('Módulo de supervisor (Revisiones)', () => {
  it('renderiza la cola de revisiones pendiente', async () => {
    vi.spyOn(apiPropiedades, 'listarPropiedades').mockResolvedValue({
      items: [
        {
          id: 'p-1',
          nombre: 'Hotel Sol',
          tipo: 'hotel',
          direccion: null,
          zona_horaria: 'America/Bogota',
        },
      ],
      total: 1,
      limite: 100,
      desplazamiento: 0,
    });
    const spyListar = vi.spyOn(apiRevisiones, 'listarLimpiezas').mockResolvedValue({
      items: [
        {
          id: 'l-1',
          asignacion_id: 'a-1',
          empleado_id: 'u-1',
          tipo: 'normal',
          limpieza_origen_id: null,
          inicio: '2026-11-14T10:00:00Z',
          fin: '2026-11-14T10:25:00Z',
          duracion_neta_seg: 1500,
          estado_trabajo: 'enviada',
          requiere_revision: true,
          estado_revision: 'pendiente',
          fecha: '2026-11-14',
          habitacion_id: 'h-1',
          habitacion_nombre: 'Suite 404',
          propiedad_id: 'p-1',
          empleado_nombre: 'Carlos',
        },
      ],
      total: 1,
      limite: 50,
      desplazamiento: 0,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/supervisor']}>
          <RevisionesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Suite 404')).toBeInTheDocument();
    expect(screen.getByText('25 min')).toBeInTheDocument();
    expect(await screen.findAllByText('Hotel Sol')).not.toHaveLength(0);
    expect(spyListar).toHaveBeenCalledWith(
      expect.objectContaining({ estadoRevision: 'pendiente', desplazamiento: 0 }),
    );
  });

  it('exige comentario obligatorio al rechazar una limpieza en DetalleRevisionPage', async () => {
    vi.spyOn(apiLimpiezas, 'obtenerDetalleLimpieza').mockResolvedValue({
      limpieza: {
        id: 'l-2',
        asignacion_id: 'a-2',
        empleado_id: 'u-1',
        tipo: 'normal',
        limpieza_origen_id: null,
        inicio: '2026-11-14T10:00:00Z',
        fin: '2026-11-14T10:20:00Z',
        duracion_neta_seg: 1200,
        estado_trabajo: 'enviada',
        requiere_revision: true,
        estado_revision: 'pendiente',
      },
      habitacion_nombre: '301',
      fecha: '2026-11-14',
      fotos: [],
      pausas: [],
      danos: [],
      revision: null,
    });
    const spyRevisar = vi.spyOn(apiRevisiones, 'revisarLimpieza');

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/supervisor/revisiones/l-2']}>
          <Routes>
            <Route path="/supervisor/revisiones/:limpiezaId" element={<DetalleRevisionPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const botonRechazar = await screen.findByRole('button', {
      name: 'Rechazar y pedir corrección',
    });
    fireEvent.click(botonRechazar);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Debes indicar el motivo al rechazar una limpieza.',
    );
    expect(spyRevisar).not.toHaveBeenCalled();
  });
});
