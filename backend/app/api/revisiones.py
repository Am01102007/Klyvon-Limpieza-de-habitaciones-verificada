from fastapi import APIRouter, status

from app.api.dependencias import GestorDep, RevisionServiceDep
from app.api.schemas import RevisionEntrada, RevisionSalida

router = APIRouter(prefix="/revisiones", tags=["revisiones"])


@router.post("", status_code=status.HTTP_201_CREATED)
def revisar_limpieza(
    datos: RevisionEntrada, actor: GestorDep, servicio: RevisionServiceDep
) -> RevisionSalida:
    """RF-12 y RF-13. Rechazar exige comentario y crea una limpieza de corrección."""
    revision = servicio.revisar(actor, datos.limpieza_id, datos.resultado, datos.comentario)
    return RevisionSalida.model_validate(revision)
