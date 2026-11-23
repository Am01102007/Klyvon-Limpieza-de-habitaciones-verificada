from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from app.api.dependencias import ActorDep, AjustesDep, AuthServiceDep, UsuarioServiceDep
from app.api.limites import LIMITE_LOGIN, LIMITE_SESION, limitador
from app.api.schemas import LoginEntrada, PerfilEntrada, SesionSalida, UsuarioSalida
from app.core.config import Settings
from app.services.auth import SesionEmitida

router = APIRouter(prefix="/auth", tags=["autenticación"])

_COOKIE_REFRESH = "refresh_token"
_RUTA_COOKIE = "/auth"


def _responder_sesion(
    respuesta: Response, sesion: SesionEmitida, ajustes: Settings
) -> SesionSalida:
    respuesta.set_cookie(
        _COOKIE_REFRESH,
        sesion.refresh_token,
        max_age=ajustes.refresh_horas * 3600,
        path=_RUTA_COOKIE,
        httponly=True,
        secure=True,
        samesite="strict",
    )
    return SesionSalida(
        access_token=sesion.access_token,
        expira_en_seg=sesion.expira_en_seg,
        usuario=UsuarioSalida.model_validate(sesion.usuario),
    )


@router.post("/login")
@limitador.limit(LIMITE_LOGIN)
def iniciar_sesion(
    request: Request,
    response: Response,
    datos: LoginEntrada,
    servicio: AuthServiceDep,
    ajustes: AjustesDep,
) -> SesionSalida:
    """RF-01. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos."""
    sesion = servicio.iniciar_sesion(datos.codigo_empresa, datos.nombre_usuario, datos.clave)
    return _responder_sesion(response, sesion, ajustes)


@router.post("/refresh")
@limitador.limit(LIMITE_SESION)
def renovar_sesion(
    request: Request,
    response: Response,
    servicio: AuthServiceDep,
    ajustes: AjustesDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> SesionSalida:
    return _responder_sesion(response, servicio.renovar(refresh_token), ajustes)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limitador.limit(LIMITE_SESION)
def cerrar_sesion(
    request: Request,
    response: Response,
    servicio: AuthServiceDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    servicio.cerrar_sesion(refresh_token)
    response.delete_cookie(
        _COOKIE_REFRESH, path=_RUTA_COOKIE, httponly=True, secure=True, samesite="strict"
    )


@router.get("/yo")
def consultar_perfil(actor: ActorDep) -> UsuarioSalida:
    return UsuarioSalida.model_validate(actor)


@router.patch("/yo")
def cambiar_idioma(
    datos: PerfilEntrada, actor: ActorDep, servicio: UsuarioServiceDep
) -> UsuarioSalida:
    """RNF-02: cada usuario elige su idioma."""
    return UsuarioSalida.model_validate(servicio.cambiar_idioma_propio(actor, datos.idioma))
