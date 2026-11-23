import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import * as apiAsignaciones from '@/api/asignaciones';
import { type TareaDelDia } from '@/api/esquemas';

import { TareasHoyPage } from './TareasHoyPage';

function crearQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const TAREA_BASE: TareaDelDia = {
  limpieza_id: 'limp-1',
  tipo: 'normal',
  estado_trabajo: 'pendiente',
  estado_revision: 'pendiente',
  inicio: null,
  asignacion_id: 'asig-1',
  fecha: '2026-11-14',
  prioridad: 1,
  hora_limite: '12:00:00',
  habitacion_id: 'hab-1',
  habitacion_nombre: 'Suite 201',
  fotos_min_entrada: 1,
  fotos_min_salida: 1,
  propiedad_nombre: 'Hotel Sol',
  zona_horaria: 'America/Mexico_City',
  comentario_rechazo: null,
};

describe('TareasHoyPage', () => {
  it('muestra estado vacío cuando no hay tareas asignadas hoy', async () => {
    vi.spyOn(apiAsignaciones, 'obtenerTareasHoy').mockResolvedValue({
      items: [],
      total: 0,
      limite: 50,
      desplazamiento: 0,
    });

    render(
      <QueryClientProvider client={crearQueryClient()}>
        <MemoryRouter>
          <TareasHoyPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('No tienes habitaciones asignadas hoy')).toBeInTheDocument();
  });

  it('bloquea el inicio de tareas pendientes si ya hay una limpieza en curso', async () => {
    vi.spyOn(apiAsignaciones, 'obtenerTareasHoy').mockResolvedValue({
      items: [
        {
          ...TAREA_BASE,
          limpieza_id: 'l-curso',
          habitacion_nombre: '101',
          estado_trabajo: 'en_curso',
        },
        {
          ...TAREA_BASE,
          limpieza_id: 'l-pend',
          habitacion_nombre: '102',
          estado_trabajo: 'pendiente',
        },
      ],
      total: 2,
      limite: 50,
      desplazamiento: 0,
    });

    render(
      <QueryClientProvider client={crearQueryClient()}>
        <MemoryRouter>
          <TareasHoyPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['101', '102']);
    expect(screen.getByRole('button', { name: 'Continuar limpieza' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Iniciar limpieza' })).toBeDisabled();
  });
});
