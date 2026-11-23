import { expect, test } from '@playwright/test';

test.describe('CP-08 Flujo guiado del empleado', () => {
  test('carga la habitación asignada y exige foto de entrada antes de avanzar', async ({
    page,
  }) => {
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'jwt-emp',
          token_type: 'bearer',
          expira_en_seg: 900,
          usuario: {
            id: 'u-1',
            empresa_id: 'e-1',
            nombre_usuario: 'maria',
            tipo_clave: 'pin',
            rol: 'empleado',
            idioma: 'es',
            activo: true,
            creado_en: '2026-11-14T10:00:00Z',
          },
        }),
      });
    });

    await page.route('**/api/asignaciones/hoy**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              limpieza_id: 'limp-1',
              tipo: 'normal',
              estado_trabajo: 'pendiente',
              estado_revision: 'pendiente',
              inicio: null,
              asignacion_id: 'asig-1',
              fecha: '2026-11-14',
              prioridad: 1,
              hora_limite: '11:00:00',
              habitacion_id: 'hab-1',
              habitacion_nombre: 'Suite 101',
              fotos_min_entrada: 1,
              fotos_min_salida: 1,
              propiedad_nombre: 'Hotel Sol',
              zona_horaria: 'America/Mexico_City',
              comentario_rechazo: null,
            },
          ],
          total: 1,
          limite: 50,
          desplazamiento: 0,
        }),
      });
    });

    await page.route('**/api/limpiezas/limp-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limpieza: {
            id: 'limp-1',
            asignacion_id: 'asig-1',
            empleado_id: 'u-1',
            tipo: 'normal',
            limpieza_origen_id: null,
            inicio: null,
            fin: null,
            duracion_neta_seg: null,
            estado_trabajo: 'pendiente',
            requiere_revision: true,
            estado_revision: 'pendiente',
          },
          habitacion_nombre: 'Suite 101',
          fecha: '2026-11-14',
          fotos: [],
          pausas: [],
          danos: [],
          revision: null,
        }),
      });
    });

    await page.goto('/empleado');
    // RNF-07: el aviso de privacidad se acepta una vez antes de empezar.
    await page.getByRole('button', { name: 'Entendido' }).click();
    await page.getByRole('button', { name: 'Iniciar limpieza' }).click();

    await expect(page).toHaveURL(/\/empleado\/limpiezas\/limp-1$/);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});
