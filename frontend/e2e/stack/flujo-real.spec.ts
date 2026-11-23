import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

// Pruebas contra el stack real: PWA compilada detrás de Caddy, API y PostgreSQL de Docker,
// con los datos de la semilla (empresa ANDINO). E2E_CLAVE es la SEMILLA_CLAVE del .env.
const CLAVE = process.env.E2E_CLAVE ?? '';
const EMPRESA = 'ANDINO';

test.beforeAll(() => {
  expect(CLAVE, 'Define E2E_CLAVE con la SEMILLA_CLAVE del .env').not.toBe('');
});

async function token(request: APIRequestContext, usuario: string): Promise<string> {
  const respuesta = await request.post('/api/auth/login', {
    data: { codigo_empresa: EMPRESA, nombre_usuario: usuario, clave: CLAVE },
  });
  expect(respuesta.status()).toBe(200);
  return ((await respuesta.json()) as { access_token: string }).access_token;
}

function primero<T>(lista: T[]): T {
  const [elemento] = lista;
  if (elemento === undefined) throw new Error('Faltan datos de la semilla');
  return elemento;
}

/** Crea una habitación nueva y se la asigna hoy a empleado2: cada corrida parte de cero. */
async function prepararLimpieza(request: APIRequestContext): Promise<string> {
  const admin = { Authorization: `Bearer ${await token(request, 'admin')}` };
  const propiedades = (await (
    await request.get('/api/propiedades', { headers: admin })
  ).json()) as {
    items: { id: string; zona_horaria: string }[];
  };
  const propiedad = primero(propiedades.items);
  const habitacion = await request.post(`/api/propiedades/${propiedad.id}/habitaciones`, {
    headers: admin,
    data: { nombre: `E2E-${String(Date.now())}` },
  });
  expect(habitacion.status()).toBe(201);
  const usuarios = (await (await request.get('/api/usuarios', { headers: admin })).json()) as {
    items: { id: string; nombre_usuario: string }[];
  };
  const empleado = primero(usuarios.items.filter((u) => u.nombre_usuario === 'empleado2'));
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: propiedad.zona_horaria }).format(
    new Date(),
  );
  const asignacion = await request.post('/api/asignaciones', {
    headers: admin,
    data: {
      habitacion_id: ((await habitacion.json()) as { id: string }).id,
      empleado_id: empleado.id,
      fecha: hoy,
    },
  });
  expect(asignacion.status()).toBe(201);
  const asignacionId = ((await asignacion.json()) as { id: string }).id;
  const limpiezas = (await (
    await request.get('/api/limpiezas', {
      headers: admin,
      params: { desde: hoy, hasta: hoy, limite: 100 },
    })
  ).json()) as { items: { id: string; asignacion_id: string }[] };
  return primero(limpiezas.items.filter((l) => l.asignacion_id === asignacionId)).id;
}

async function entrar(page: Page, usuario: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Código de empresa').fill(EMPRESA);
  await page.getByLabel('Usuario', { exact: true }).fill(usuario);
  await page.getByLabel('Contraseña o PIN').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/empleado/);
  // RNF-07: cada empleado acepta el aviso de privacidad una vez por teléfono.
  await page.getByRole('button', { name: 'Entendido' }).click();
  await expect(page.getByRole('heading', { name: 'Mis habitaciones de hoy' })).toBeVisible();
}

async function tomarFoto(page: Page, boton: string): Promise<void> {
  await page.getByRole('button', { name: boton }).click();
  await page.getByRole('button', { name: 'Capturar foto' }).click();
  await page.getByRole('button', { name: 'Usar esta foto' }).click();
}

test('CP-01 y CP-24: el empleado entra desde el celular y la vista no se desborda', async ({
  page,
}) => {
  await entrar(page, 'empleado1');

  const anchos = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(anchos[0]).toBeLessThanOrEqual(anchos[1] ?? 0);
});

test('PWA: el service worker deja abrir la app sin red', async ({ page, context }) => {
  await entrar(page, 'empleado1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mis habitaciones de hoy' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByText(/Sin conexión a internet|Entraste sin señal/).first()).toBeVisible();
  await context.setOffline(false);
});

test('CP-21: limpieza terminada sin red se sincroniza al volver, sin duplicados', async ({
  page,
  context,
  request,
}) => {
  const limpiezaId = await prepararLimpieza(request);
  await entrar(page, 'empleado2');
  await page.goto(`/empleado/limpiezas/${limpiezaId}`);

  await tomarFoto(page, 'Tomar primera foto e iniciar');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'No hay daños' }).click();
  await page.getByRole('button', { name: 'Tomar fotos de salida' }).click();

  await context.setOffline(true);
  await tomarFoto(page, 'Tomar foto de salida');
  await page.getByRole('button', { name: 'Finalizar limpieza' }).click();
  await expect(page.getByText(/guardó en el dispositivo|Pendiente de envío/).first()).toBeVisible();

  await context.setOffline(false);
  const admin = { Authorization: `Bearer ${await token(request, 'admin')}` };
  await expect
    .poll(
      async () => {
        const detalle = await request.get(`/api/limpiezas/${limpiezaId}`, { headers: admin });
        return ((await detalle.json()) as { limpieza: { estado_trabajo: string } }).limpieza
          .estado_trabajo;
      },
      { timeout: 30_000 },
    )
    .toBe('enviada');

  const detalle = (await (
    await request.get(`/api/limpiezas/${limpiezaId}`, { headers: admin })
  ).json()) as { fotos: { momento: string }[]; limpieza: { duracion_neta_seg: number } };
  expect(detalle.fotos.map((f) => f.momento).sort()).toEqual(['entrada', 'salida']);
  expect(detalle.limpieza.duracion_neta_seg).toBeGreaterThanOrEqual(0);
});

test('Seguridad HTTP: cabeceras del sitio y de la API detrás de Caddy', async ({ request }) => {
  for (const ruta of ['/', '/api/health']) {
    const respuesta = await request.get(ruta);
    const cabeceras = respuesta.headers();
    expect(respuesta.status()).toBe(200);
    expect(cabeceras['x-content-type-options']).toBe('nosniff');
    expect(cabeceras['x-frame-options']).toBe('DENY');
    expect(cabeceras['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(cabeceras['permissions-policy']).toContain('camera=(self)');
    expect(cabeceras['server']).toBeUndefined();
  }
  expect((await request.get('/api/docs')).status()).toBe(404);
  expect((await request.get('/api/usuarios')).status()).toBe(401);
});

test('Seguridad: la cookie de sesión es HttpOnly, Secure y SameSite=Strict', async ({
  request,
}) => {
  const respuesta = await request.post('/api/auth/login', {
    data: { codigo_empresa: EMPRESA, nombre_usuario: 'empleado1', clave: CLAVE },
  });
  const cookie = respuesta.headers()['set-cookie'] ?? '';

  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toMatch(/SameSite=strict/i);
  expect(cookie).toContain('Path=/api/auth');
});
