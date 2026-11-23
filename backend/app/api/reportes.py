import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Response

from app.api.dependencias import (
    GestorDep,
    PaginacionDep,
    ReportePdfServiceDep,
    ReporteServiceDep,
)
from app.api.schemas import (
    DanosPropiedadSalida,
    PaginaSalida,
    TiempoEmpleadoSalida,
    TiempoHabitacionSalida,
)

router = APIRouter(prefix="/reportes", tags=["reportes"])

_RESPUESTA_PDF: dict[int | str, dict[str, Any]] = {
    200: {"content": {"application/pdf": {}}, "description": "Documento PDF"}
}


def _pdf(contenido: bytes, nombre: str) -> Response:
    return Response(
        contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}.pdf"'},
    )


@router.get("/tiempos/habitaciones")
def tiempos_por_habitacion(
    actor: GestorDep,
    servicio: ReporteServiceDep,
    paginacion: PaginacionDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> PaginaSalida[TiempoHabitacionSalida]:
    """RF-15: tiempo neto promedio por habitación, sin contar correcciones."""
    pagina = servicio.tiempos_por_habitacion(
        actor, paginacion, desde, hasta, propiedad_id, empleado_id
    )
    return PaginaSalida[TiempoHabitacionSalida].model_validate(pagina, from_attributes=True)


@router.get("/tiempos/empleados")
def tiempos_por_empleado(
    actor: GestorDep,
    servicio: ReporteServiceDep,
    paginacion: PaginacionDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> PaginaSalida[TiempoEmpleadoSalida]:
    """RF-15: tiempo neto promedio por empleado, sin contar correcciones."""
    pagina = servicio.tiempos_por_empleado(
        actor, paginacion, desde, hasta, propiedad_id, empleado_id
    )
    return PaginaSalida[TiempoEmpleadoSalida].model_validate(pagina, from_attributes=True)


@router.get("/danos")
def danos_por_propiedad(
    actor: GestorDep,
    servicio: ReporteServiceDep,
    paginacion: PaginacionDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
) -> PaginaSalida[DanosPropiedadSalida]:
    """RF-15: daños por propiedad."""
    pagina = servicio.danos_por_propiedad(actor, paginacion, desde, hasta, propiedad_id)
    return PaginaSalida[DanosPropiedadSalida].model_validate(pagina, from_attributes=True)


@router.get("/tiempos/habitaciones/pdf", response_class=Response, responses=_RESPUESTA_PDF)
def tiempos_por_habitacion_pdf(
    actor: GestorDep,
    servicio: ReportePdfServiceDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> Response:
    """RF-17."""
    contenido = servicio.tiempos_por_habitacion(actor, desde, hasta, propiedad_id, empleado_id)
    return _pdf(contenido, "tiempos-por-habitacion")


@router.get("/tiempos/empleados/pdf", response_class=Response, responses=_RESPUESTA_PDF)
def tiempos_por_empleado_pdf(
    actor: GestorDep,
    servicio: ReportePdfServiceDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> Response:
    """RF-17."""
    contenido = servicio.tiempos_por_empleado(actor, desde, hasta, propiedad_id, empleado_id)
    return _pdf(contenido, "tiempos-por-empleado")


@router.get("/danos/pdf", response_class=Response, responses=_RESPUESTA_PDF)
def danos_por_propiedad_pdf(
    actor: GestorDep,
    servicio: ReportePdfServiceDep,
    desde: date | None = None,
    hasta: date | None = None,
    propiedad_id: uuid.UUID | None = None,
) -> Response:
    """RF-17."""
    contenido = servicio.danos_por_propiedad(actor, desde, hasta, propiedad_id)
    return _pdf(contenido, "danos-por-propiedad")
