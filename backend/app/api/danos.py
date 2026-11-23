import uuid

from fastapi import APIRouter

from app.api.dependencias import DanoServiceDep, GestorDep, PaginacionDep
from app.api.schemas import (
    DanoEstadoEntrada,
    DanoResumenSalida,
    DetalleDanoSalida,
    PaginaSalida,
)
from app.models.enums import EstadoDano

router = APIRouter(prefix="/danos", tags=["daños"])


@router.get("")
def listar_danos(
    actor: GestorDep,
    servicio: DanoServiceDep,
    paginacion: PaginacionDep,
    estado: EstadoDano | None = None,
    propiedad_id: uuid.UUID | None = None,
) -> PaginaSalida[DanoResumenSalida]:
    pagina = servicio.listar(actor, paginacion, estado, propiedad_id)
    return PaginaSalida[DanoResumenSalida].model_validate(pagina, from_attributes=True)


@router.get("/{dano_id}")
def consultar_dano(
    dano_id: uuid.UUID, actor: GestorDep, servicio: DanoServiceDep
) -> DetalleDanoSalida:
    return DetalleDanoSalida.model_validate(servicio.detalle(actor, dano_id))


@router.patch("/{dano_id}/estado")
def cambiar_estado_dano(
    dano_id: uuid.UUID,
    datos: DanoEstadoEntrada,
    actor: GestorDep,
    servicio: DanoServiceDep,
) -> DetalleDanoSalida:
    """RF-14: cada cambio queda en el historial."""
    return DetalleDanoSalida.model_validate(servicio.cambiar_estado(actor, dano_id, datos.estado))
