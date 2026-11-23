from fastapi import APIRouter, status

from app.api.dependencias import SaludServiceDep
from app.api.schemas import ErrorSalida, SaludSalida

router = APIRouter(tags=["salud"])


@router.get(
    "/health",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ErrorSalida}},
)
def consultar_salud(servicio: SaludServiceDep) -> SaludSalida:
    servicio.comprobar()
    return SaludSalida(estado="ok")
