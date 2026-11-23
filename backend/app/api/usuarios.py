import uuid

from fastapi import APIRouter, Request, status

from app.api.dependencias import AdminDep, GestorDep, PaginacionDep, UsuarioServiceDep
from app.api.limites import LIMITE_CLAVE, limitador
from app.api.schemas import (
    ClaveEntrada,
    PaginaSalida,
    UsuarioCambios,
    UsuarioEntrada,
    UsuarioSalida,
)
from app.models.enums import Rol
from app.services.usuarios import DatosNuevoUsuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("")
def listar_usuarios(
    actor: GestorDep,
    servicio: UsuarioServiceDep,
    paginacion: PaginacionDep,
    rol: Rol | None = None,
) -> PaginaSalida[UsuarioSalida]:
    pagina = servicio.listar(actor, paginacion, rol)
    return PaginaSalida[UsuarioSalida].model_validate(pagina, from_attributes=True)


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioEntrada, actor: AdminDep, servicio: UsuarioServiceDep
) -> UsuarioSalida:
    """RF-02."""
    usuario = servicio.crear(
        actor,
        DatosNuevoUsuario(
            nombre_usuario=datos.nombre_usuario,
            clave=datos.clave,
            tipo_clave=datos.tipo_clave,
            rol=datos.rol,
            idioma=datos.idioma,
        ),
    )
    return UsuarioSalida.model_validate(usuario)


@router.get("/{usuario_id}")
def consultar_usuario(
    usuario_id: uuid.UUID, actor: GestorDep, servicio: UsuarioServiceDep
) -> UsuarioSalida:
    return UsuarioSalida.model_validate(servicio.obtener(actor, usuario_id))


@router.patch("/{usuario_id}")
def editar_usuario(
    usuario_id: uuid.UUID,
    datos: UsuarioCambios,
    actor: AdminDep,
    servicio: UsuarioServiceDep,
) -> UsuarioSalida:
    """RF-02: editar y desactivar, sin borrar el historial."""
    usuario = servicio.actualizar(
        actor, usuario_id, datos.nombre_usuario, datos.idioma, datos.rol, datos.activo
    )
    return UsuarioSalida.model_validate(usuario)


@router.post("/{usuario_id}/clave", status_code=status.HTTP_204_NO_CONTENT)
@limitador.limit(LIMITE_CLAVE)
def restablecer_clave(
    request: Request,
    usuario_id: uuid.UUID,
    datos: ClaveEntrada,
    actor: GestorDep,
    servicio: UsuarioServiceDep,
) -> None:
    """RF-03."""
    servicio.restablecer_clave(actor, usuario_id, datos.clave, datos.tipo_clave)
