import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, Request, UploadFile, status
from pydantic import StringConstraints

from app.api.dependencias import ActorDep, EmpleadoDep, GestorDep, LimpiezaServiceDep, PaginacionDep
from app.api.limites import LIMITE_FOTOS, limitador
from app.api.schemas import (
    DanoSalida,
    DetalleLimpiezaSalida,
    FotoSalida,
    LimpiezaResumenSalida,
    LimpiezaSalida,
    PaginaSalida,
    PausaEntrada,
    PausaSalida,
)
from app.core.imagenes import MAX_BYTES_SUBIDA
from app.models.enums import CategoriaDano, EstadoRevision, GravedadDano, MomentoFoto

router = APIRouter(prefix="/limpiezas", tags=["limpiezas"])

Archivo = Annotated[UploadFile, File(description="Foto tomada con la cámara")]
IdCliente = Annotated[
    uuid.UUID | None, Form(description="Generado en el teléfono: evita duplicados")
]
Nota = Annotated[str | None, Form(), StringConstraints(strip_whitespace=True, max_length=1000)]


def _leer(archivo: UploadFile) -> bytes:
    """Lee un byte de más para detectar archivos sobre el límite sin cargarlos enteros."""
    return archivo.file.read(MAX_BYTES_SUBIDA + 1)


@router.get("")
def listar_limpiezas(
    actor: GestorDep,
    servicio: LimpiezaServiceDep,
    paginacion: PaginacionDep,
    estado_revision: EstadoRevision | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> PaginaSalida[LimpiezaResumenSalida]:
    """Con `estado_revision=pendiente` es la cola del supervisor (HU-11)."""
    pagina = servicio.listar(
        actor, paginacion, estado_revision, propiedad_id, empleado_id, desde, hasta
    )
    return PaginaSalida[LimpiezaResumenSalida].model_validate(pagina, from_attributes=True)


@router.get("/{limpieza_id}")
def consultar_limpieza(
    limpieza_id: uuid.UUID, actor: ActorDep, servicio: LimpiezaServiceDep
) -> DetalleLimpiezaSalida:
    return DetalleLimpiezaSalida.model_validate(servicio.detalle(actor, limpieza_id))


@router.post("/{limpieza_id}/iniciar")
@limitador.limit(LIMITE_FOTOS)
def iniciar_limpieza(
    request: Request,
    limpieza_id: uuid.UUID,
    archivo: Archivo,
    actor: EmpleadoDep,
    servicio: LimpiezaServiceDep,
    foto_id: IdCliente = None,
) -> LimpiezaSalida:
    """RF-07: la primera foto de entrada arranca el cronómetro con la hora del servidor."""
    limpieza = servicio.iniciar(actor, limpieza_id, _leer(archivo), foto_id)
    return LimpiezaSalida.model_validate(limpieza)


@router.post("/{limpieza_id}/fotos", status_code=status.HTTP_201_CREATED)
@limitador.limit(LIMITE_FOTOS)
def agregar_foto(
    request: Request,
    limpieza_id: uuid.UUID,
    momento: Annotated[Literal[MomentoFoto.ENTRADA, MomentoFoto.SALIDA], Form()],
    archivo: Archivo,
    actor: EmpleadoDep,
    servicio: LimpiezaServiceDep,
    foto_id: IdCliente = None,
) -> FotoSalida:
    """RF-07 y RF-10."""
    foto = servicio.agregar_foto(actor, limpieza_id, momento, _leer(archivo), foto_id)
    return FotoSalida.model_validate(foto)


@router.post("/{limpieza_id}/pausas", status_code=status.HTTP_201_CREATED)
def pausar_limpieza(
    limpieza_id: uuid.UUID,
    datos: PausaEntrada,
    actor: EmpleadoDep,
    servicio: LimpiezaServiceDep,
) -> PausaSalida:
    """RF-09."""
    return PausaSalida.model_validate(servicio.pausar(actor, limpieza_id, datos.motivo, datos.id))


@router.post("/{limpieza_id}/reanudar")
def reanudar_limpieza(
    limpieza_id: uuid.UUID, actor: EmpleadoDep, servicio: LimpiezaServiceDep
) -> PausaSalida:
    """RF-09."""
    return PausaSalida.model_validate(servicio.reanudar(actor, limpieza_id))


@router.post("/{limpieza_id}/danos", status_code=status.HTTP_201_CREATED)
@limitador.limit(LIMITE_FOTOS)
def reportar_dano(
    request: Request,
    limpieza_id: uuid.UUID,
    categoria: Annotated[CategoriaDano, Form()],
    gravedad: Annotated[GravedadDano, Form()],
    archivo: Archivo,
    actor: EmpleadoDep,
    servicio: LimpiezaServiceDep,
    nota: Nota = None,
    dano_id: IdCliente = None,
) -> DanoSalida:
    """RF-08: foto, categoría y gravedad obligatorias; nota opcional."""
    dano = servicio.reportar_dano(
        actor, limpieza_id, categoria, gravedad, nota, _leer(archivo), dano_id
    )
    return DanoSalida.model_validate(dano)


@router.post("/{limpieza_id}/finalizar")
def finalizar_limpieza(
    limpieza_id: uuid.UUID, actor: EmpleadoDep, servicio: LimpiezaServiceDep
) -> LimpiezaSalida:
    """RF-10 y RF-11. No recibe tiempos: la hora y la duración son del servidor (RNF-06)."""
    return LimpiezaSalida.model_validate(servicio.finalizar(actor, limpieza_id))
