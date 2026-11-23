import { expect, type Page, test } from '@playwright/test';

// CP-24 (RNF-10): a 360 px no hay desplazamiento horizontal y los botones se pueden tocar.
test.use({ viewport: { width: 360, height: 780 } });

const usuarioEmpleado = {
  id: 'u-1',
  empresa_id: 'e-1',
  nombre_usuario: 'maria',
  tipo_clave: 'pin',
  rol: 'empleado',
  idioma: 'es',
  activo: true,
  creado_en: '2026-11-14T10:00:00Z',
};

const tarea = {
  limpieza_id: 'limp-1',
  tipo: 'normal',
  estado_trabajo: 'pendiente',
  estado_revision: 'no_requerida',
  inicio: null,
  asignacion_id: 'asig-1',
  fecha: '2026-11-14',
  prioridad: 1,
  hora_limite: '11:00:00',
  habitacion_id: 'hab-1',
  habitacion_nombre: 'Suite 101 con un nombre largo para probar el ajuste de línea',
  fotos_min_entrada: 1,
  fotos_min_salida: 1,
  propiedad_nombre: 'Hotel Sol',
  zona_horaria: 'America/Bogota',
  comentario_rechazo: null,
};

async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const anchos = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
  expect(anchos.documento).toBeLessThanOrEqual(anchos.ventana);
}

async function botonesTocables(page: Page): Promise<void> {
  const botones = page.getByRole('button');
  const total = await botones.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i += 1) {
    const boton = botones.nth(i);
    if (!(await boton.isVisible())) continue;
    const caja = (await boton.boundingBox()) ?? { width: 0, height: 0 };
    // WCAG 2.2 (2.5.8): objetivo táctil mínimo de 24 × 24 px.
    expect(caja.width, `ancho del botón ${String(i)}`).toBeGreaterThanOrEqual(24);
    expect(caja.height, `alto del botón ${String(i)}`).toBeGreaterThanOrEqual(24);
  }
}

test.describe('CP-24 Vista de celular a 360 px', () => {
  test('la pantalla de inicio de sesión cabe y sus botones se pueden tocar', async ({ page }) => {
    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ codigo: 'no_autenticado' }) }),
    );

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await sinDesbordeHorizontal(page);
    await botonesTocables(page);
  });

  test('la lista del día del empleado cabe y sus botones se pueden tocar', async ({ page }) => {
    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'jwt-emp',
          token_type: 'bearer',
          expira_en_seg: 900,
          usuario: usuarioEmpleado,
        }),
      }),
    );
    await page.route('**/api/asignaciones/hoy**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [tarea], total: 1, limite: 50, desplazamiento: 0 }),
      }),
    );

    await page.goto('/empleado');
    await expect(page.getByText(/Suite 101/)).toBeVisible();

    await sinDesbordeHorizontal(page);
    await botonesTocables(page);
  });
});
