import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException

from app.api.schemas import CampoInvalido, ErrorSalida
from app.core.exceptions import (
    ArchivoDemasiadoGrande,
    Conflicto,
    CuentaBloqueada,
    EntradaInvalida,
    ErrorDominio,
    NoAutenticado,
    NoEncontrado,
    ServicioNoDisponible,
    SinPermiso,
)

logger = logging.getLogger(__name__)

_ESTADOS_HTTP: dict[type[ErrorDominio], int] = {
    ServicioNoDisponible: status.HTTP_503_SERVICE_UNAVAILABLE,
    NoAutenticado: status.HTTP_401_UNAUTHORIZED,
    CuentaBloqueada: status.HTTP_423_LOCKED,
    SinPermiso: status.HTTP_403_FORBIDDEN,
    NoEncontrado: status.HTTP_404_NOT_FOUND,
    Conflicto: status.HTTP_409_CONFLICT,
    EntradaInvalida: status.HTTP_422_UNPROCESSABLE_CONTENT,
    ArchivoDemasiadoGrande: status.HTTP_413_CONTENT_TOO_LARGE,
}
_CODIGOS_HTTP = {
    status.HTTP_401_UNAUTHORIZED: "no_autenticado",
    status.HTTP_403_FORBIDDEN: "sin_permiso",
    status.HTTP_404_NOT_FOUND: "no_encontrado",
    status.HTTP_405_METHOD_NOT_ALLOWED: "metodo_no_permitido",
}


def _respuesta(estado: int, error: ErrorSalida) -> JSONResponse:
    encabezados = {"WWW-Authenticate": "Bearer"} if estado == status.HTTP_401_UNAUTHORIZED else None
    return JSONResponse(
        status_code=estado,
        content=error.model_dump(exclude_none=True),
        headers=encabezados,
    )


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorDominio)
    def manejar_error_dominio(_: Request, error: ErrorDominio) -> JSONResponse:
        estado = _ESTADOS_HTTP.get(type(error), status.HTTP_400_BAD_REQUEST)
        return _respuesta(estado, ErrorSalida(codigo=error.codigo))

    @app.exception_handler(RequestValidationError)
    def manejar_validacion(_: Request, error: RequestValidationError) -> JSONResponse:
        """No devuelve los valores recibidos: podrían incluir una contraseña."""
        campos = [
            CampoInvalido(
                campo=".".join(str(parte) for parte in detalle["loc"]), tipo=detalle["type"]
            )
            for detalle in error.errors()
        ]
        return _respuesta(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorSalida(codigo="entrada_invalida", campos=campos),
        )

    @app.exception_handler(HTTPException)
    def manejar_http(_: Request, error: HTTPException) -> JSONResponse:
        codigo = _CODIGOS_HTTP.get(error.status_code, "error_peticion")
        return _respuesta(error.status_code, ErrorSalida(codigo=codigo))

    @app.exception_handler(RateLimitExceeded)
    def manejar_limite(_: Request, __: RateLimitExceeded) -> JSONResponse:
        return _respuesta(
            status.HTTP_429_TOO_MANY_REQUESTS, ErrorSalida(codigo="demasiadas_peticiones")
        )

    @app.exception_handler(Exception)
    def manejar_error_inesperado(request: Request, error: Exception) -> JSONResponse:
        logger.error(
            "Error inesperado en %s %s",
            request.method,
            request.url.path,
            exc_info=error,
        )
        return _respuesta(
            status.HTTP_500_INTERNAL_SERVER_ERROR, ErrorSalida(codigo="error_interno")
        )
