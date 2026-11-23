import { expect, test } from '@playwright/test';

test.describe('CP-01 Inicio de sesión', () => {
  test('muestra errores de validación en español cuando los campos están vacíos', async ({
    page,
  }) => {
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ codigo: 'no_autenticado' }),
      });
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByText('Ingresa el código de empresa (1 a 20 caracteres).')).toBeVisible();
  });

  test('inicia sesión como empleado y navega a /empleado', async ({ page }) => {
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ codigo: 'no_autenticado' }) });
    });
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'jwt-test',
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

    await page.goto('/login');
    await page.getByLabel('Código de empresa').fill('HOTELSOL');
    await page.getByLabel('Usuario').fill('maria');
    await page.getByLabel('Contraseña o PIN').fill('1234');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/empleado$/);
    await expect(page.getByRole('heading', { name: 'Mis habitaciones de hoy' })).toBeVisible();
  });
});
