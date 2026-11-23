from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.imagenes import MAX_BYTES_SUBIDA

_MARGEN_MULTIPART = 1024 * 1024
_RUTAS_DOCUMENTACION = ("/docs", "/redoc", "/openapi.json")
_CSP_API = "default-src 'none'; frame-ancestors 'none'"


def registrar_seguridad_http(app: FastAPI, produccion: bool) -> None:
    @app.middleware("http")
    async def aplicar(
        request: Request, siguiente: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        longitud = request.headers.get("content-length", "0")
        if longitud.isdigit() and int(longitud) > MAX_BYTES_SUBIDA + _MARGEN_MULTIPART:
            return JSONResponse(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                content={"codigo": "archivo_demasiado_grande"},
            )
        respuesta = await siguiente(request)
        respuesta.headers["X-Content-Type-Options"] = "nosniff"
        respuesta.headers["Referrer-Policy"] = "no-referrer"
        if not request.url.path.startswith(_RUTAS_DOCUMENTACION):
            respuesta.headers["Content-Security-Policy"] = _CSP_API
        if produccion:
            respuesta.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return respuesta
