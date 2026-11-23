/**
 * Verifica que la capa api/ llame a las rutas, métodos y cuerpos reales del backend
 * (backend/app/api). Si el backend cambia, estas pruebas deben cambiar con él.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearAsignacion, listarAsignaciones } from './asignaciones';
import { actualizarIdioma } from './auth';
import { establecerTokenMemoria, limpiarTokenMemoria } from './cliente';
import { cambiarEstadoDano, listarDanos } from './danos';
import { actualizarEmpresa } from './empresa';
import { desvincularSupervisor, vincularSupervisor } from './propiedades';
import { descargarReportePdf, obtenerTiemposEmpleados } from './reportes';
import { listarLimpiezas, revisarLimpieza } from './revisiones';
import { actualizarUsuario, cambiarClaveUsuario } from './usuarios';

const USUARIO = {
  id: 'u-1',
  empresa_id: 'e-1',
  nombre_usuario: 'ana',
  tipo_clave: 'contrasena',
  rol: 'admin',
  idioma: 'es',
  activo: true,
  creado_en: '2026-11-14T10:00:00Z',
};

const PAGINA_VACIA = { items: [], total: 0, limite: 50, desplazamiento: 0 };

const DETALLE_DANO = {
  dano: {
    id: 'd-1',
    limpieza_id: 'l-1',
    categoria: 'rotura',
    gravedad: 'urgente',
    nota: null,
    estado: 'resuelto',
    creado_en: '2026-11-14T10:00:00Z',
  },
  propiedad_id: 'p-1',
  fotos: [],
  historial: [
    {
      id: 'hst-1',
      usuario_id: 'u-1',
      estado_anterior: 'abierto',
      estado_nuevo: 'resuelto',
      cambiado_en: '2026-11-14T11:00:00Z',
    },
  ],
};

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function ultimaLlamada(): { url: string; metodo: string; cuerpo: unknown } {
  const [url, opciones] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    metodo: opciones.method ?? 'GET',
    cuerpo: typeof opciones.body === 'string' ? JSON.parse(opciones.body) : undefined,
  };
}

describe('contrato con el backend', () => {
  beforeEach(() => {
    establecerTokenMemoria('t');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limpiarTokenMemoria();
  });

  it('cambia el idioma propio con PATCH /auth/yo', async () => {
    fetchMock.mockResolvedValue(respuesta(USUARIO));
    await actualizarIdioma('pt');
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/auth\/yo$/) as string,
      metodo: 'PATCH',
      cuerpo: { idioma: 'pt' },
    });
  });

  it('revisa con POST /revisiones y limpieza_id en el cuerpo', async () => {
    fetchMock.mockResolvedValue(
      respuesta(
        {
          id: 'r-1',
          limpieza_id: 'l-1',
          supervisor_id: 'u-1',
          resultado: 'rechazada',
          comentario: 'Falta el baño',
          revisado_en: '2026-11-14T11:00:00Z',
        },
        201,
      ),
    );
    await revisarLimpieza({
      limpiezaId: 'l-1',
      resultado: 'rechazada',
      comentario: ' Falta el baño ',
    });
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/revisiones$/) as string,
      metodo: 'POST',
      cuerpo: { limpieza_id: 'l-1', resultado: 'rechazada', comentario: 'Falta el baño' },
    });
  });

  it('lista limpiezas sin mandar filtros vacíos', async () => {
    fetchMock.mockResolvedValue(respuesta(PAGINA_VACIA));
    await listarLimpiezas({ estadoRevision: 'pendiente', propiedadId: '' });
    const { url } = ultimaLlamada();
    expect(url).toContain('/limpiezas?');
    expect(url).toContain('estado_revision=pendiente');
    expect(url).not.toContain('propiedad_id');
  });

  it('crea asignaciones y acepta la respuesta corta de creación', async () => {
    fetchMock.mockResolvedValue(
      respuesta(
        {
          id: 'a-1',
          habitacion_id: 'h-1',
          empleado_id: 'u-2',
          asignado_por: 'u-1',
          fecha: '2026-11-14',
          prioridad: 1,
          hora_limite: '14:00:00',
        },
        201,
      ),
    );
    const creada = await crearAsignacion({
      fecha: '2026-11-14',
      habitacion_id: 'h-1',
      empleado_id: 'u-2',
      prioridad: 1,
      hora_limite: '14:00:00',
    });
    expect(creada.asignado_por).toBe('u-1');
    expect(ultimaLlamada().metodo).toBe('POST');
  });

  it('filtra asignaciones por fecha, propiedad y empleado', async () => {
    fetchMock.mockResolvedValue(respuesta(PAGINA_VACIA));
    await listarAsignaciones({ fecha: '2026-11-14', propiedadId: 'p-1', empleadoId: 'u-2' });
    const { url } = ultimaLlamada();
    expect(url).toContain('fecha=2026-11-14');
    expect(url).toContain('propiedad_id=p-1');
    expect(url).toContain('empleado_id=u-2');
  });

  it('cambia el estado de un daño con PATCH /danos/{id}/estado y lee el historial', async () => {
    fetchMock.mockResolvedValue(respuesta(DETALLE_DANO));
    const detalle = await cambiarEstadoDano('d-1', 'resuelto');
    expect(detalle.historial).toHaveLength(1);
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/danos\/d-1\/estado$/) as string,
      metodo: 'PATCH',
      cuerpo: { estado: 'resuelto' },
    });
  });

  it('no manda gravedad al listar daños (el backend no la filtra)', async () => {
    fetchMock.mockResolvedValue(respuesta(PAGINA_VACIA));
    await listarDanos({ estado: 'abierto' });
    expect(ultimaLlamada().url).not.toContain('gravedad');
  });

  it('vincula supervisores con usuario_id y los desvincula con DELETE', async () => {
    fetchMock.mockResolvedValue(respuesta(null, 204));
    await vincularSupervisor('p-1', 'u-3');
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/propiedades\/p-1\/supervisores$/) as string,
      metodo: 'POST',
      cuerpo: { usuario_id: 'u-3' },
    });
    fetchMock.mockResolvedValue(respuesta(null, 204));
    await desvincularSupervisor('p-1', 'u-3');
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/propiedades\/p-1\/supervisores\/u-3$/) as string,
      metodo: 'DELETE',
    });
  });

  it('nunca manda la clave en el PATCH de usuario; usa POST /usuarios/{id}/clave', async () => {
    fetchMock.mockResolvedValue(respuesta(USUARIO));
    await actualizarUsuario('u-1', { activo: false });
    expect(ultimaLlamada().cuerpo).toEqual({ activo: false });

    fetchMock.mockResolvedValue(respuesta(null, 204));
    await cambiarClaveUsuario('u-1', { clave: '1234', tipo_clave: 'pin' });
    expect(ultimaLlamada()).toMatchObject({
      url: expect.stringMatching(/\/usuarios\/u-1\/clave$/) as string,
      metodo: 'POST',
      cuerpo: { clave: '1234', tipo_clave: 'pin' },
    });
  });

  it('configura la empresa con los campos reales', async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        id: 'e-1',
        nombre: 'Demo',
        codigo: 'DEMO',
        idioma: 'es',
        plan: 'piloto',
        regla_revision: 'muestra',
        muestra_n: 5,
        retencion_fotos_dias: 90,
      }),
    );
    await actualizarEmpresa({ regla_revision: 'muestra', muestra_n: 5 });
    expect(ultimaLlamada()).toMatchObject({
      metodo: 'PATCH',
      cuerpo: { regla_revision: 'muestra', muestra_n: 5 },
    });
  });

  it('pide los reportes a sus rutas, con PDF como Blob y sin paginación', async () => {
    fetchMock.mockResolvedValue(respuesta(PAGINA_VACIA));
    await obtenerTiemposEmpleados({ desde: '2026-11-01', empleadoId: 'u-2' });
    expect(ultimaLlamada().url).toMatch(/\/reportes\/tiempos\/empleados\?.*empleado_id=u-2/);

    fetchMock.mockResolvedValue(
      new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    );
    const pdf = await descargarReportePdf('danos', { desde: '2026-11-01', empleadoId: 'u-2' });
    expect(pdf.size).toBeGreaterThan(0);
    const { url } = ultimaLlamada();
    expect(url).toMatch(/\/reportes\/danos\/pdf\?/);
    expect(url).not.toContain('empleado_id');
    expect(url).not.toContain('limite');
  });
});
