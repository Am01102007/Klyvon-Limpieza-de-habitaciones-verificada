import { expect, test } from '@playwright/test';

test.describe('CP-21 Indicador sin conexión y sincronización', () => {
  test('muestra el aviso sin conexión cuando el navegador pasa a modo offline', async ({
    context,
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
        body: JSON.stringify({ items: [], total: 0, limite: 50, desplazamiento: 0 }),
      });
    });

    await page.goto('/empleado');
    await context.setOffline(true);

    await expect(
      page.getByText('Sin conexión a internet. Tus capturas se guardarán en la cola local.'),
    ).toBeVisible();

    await context.setOffline(false);
  });
});
