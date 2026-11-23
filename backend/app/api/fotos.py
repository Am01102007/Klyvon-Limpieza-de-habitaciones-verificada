from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from app.api.dependencias import AlmacenDep, RelojDep
from app.core.almacen_fotos import AlmacenLocal
from app.core.exceptions import NoEncontrado

router = APIRouter(prefix="/fotos", tags=["fotos"])


@router.get("/archivo", response_class=FileResponse)
def descargar_foto(
    almacen: AlmacenDep,
    reloj: RelojDep,
    clave: Annotated[str, Query(max_length=300)],
    expira: int,
    firma: Annotated[str, Query(max_length=64)],
) -> FileResponse:
    """Sin token: la autoriza la firma de corta duración que emite cada endpoint con fotos."""
    if not isinstance(almacen, AlmacenLocal):
        raise NoEncontrado
    try:
        ruta = almacen.ruta_si_firma_valida(clave, expira, firma, reloj.ahora())
    except ValueError as error:
        raise NoEncontrado from error
    if ruta is None:
        raise NoEncontrado
    return FileResponse(ruta, media_type="image/jpeg", headers={"Cache-Control": "private"})
