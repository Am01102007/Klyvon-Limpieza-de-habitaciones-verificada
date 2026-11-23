import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ErrorApi, establecerTokenMemoria, limpiarTokenMemoria, solicitar } from './cliente';

const ItemSchema = z.object({ ok: z.boolean() });

describe('cliente HTTP', () => {
  beforeEach(() => {
    limpiarTokenMemoria();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limpiarTokenMemoria();
  });

  it('envía el token en Authorization cuando existe en memoria', async () => {
    establecerTokenMemoria('token-123');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await solicitar('/prueba', ItemSchema);
    expect(resultado).toEqual({ ok: true });

    const llamada = fetchMock.mock.calls[0];
    expect(llamada).toBeDefined();
    const opciones = llamada?.[1] as RequestInit;
    const headers = new Headers(opciones.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('intenta un refresh ante 401 no_autenticado y reintenta la petición una vez', async () => {
    establecerTokenMemoria('token-viejo');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ codigo: 'no_autenticado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'token-nuevo',
            token_type: 'bearer',
            expira_en_seg: 900,
            usuario: {
              id: 'u-1',
              empresa_id: 'e-1',
              nombre_usuario: 'ana',
              tipo_clave: 'pin',
              rol: 'empleado',
              idioma: 'es',
              activo: true,
              creado_en: '2026-11-14T10:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await solicitar('/prueba', ItemSchema);
    expect(resultado).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lanza ErrorApi respuesta_invalida si el cuerpo no cumple el esquema Zod', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: 'si' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(solicitar('/prueba', ItemSchema)).rejects.toMatchObject({
      codigo: 'respuesta_invalida',
    });
  });

  it('lanza ErrorApi error_red cuando falla el transporte', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(solicitar('/prueba', ItemSchema)).rejects.toBeInstanceOf(ErrorApi);
    await expect(solicitar('/prueba', ItemSchema)).rejects.toMatchObject({
      codigo: 'error_red',
    });
  });
});
