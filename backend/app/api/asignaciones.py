import uuid
from datetime import date

from fastapi import APIRouter, status

from app.api.dependencias import AsignacionServiceDep, EmpleadoDep, GestorDep, PaginacionDep
from app.api.schemas import (
    AsignacionCreadaSalida,
    AsignacionEntrada,
    AsignacionSalida,
    PaginaSalida,
    TareaDelDiaSalida,
)
from app.services.asignaciones import DatosAsignacion

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


@router.get("/hoy")
def consultar_tareas_de_hoy(
    actor: EmpleadoDep, servicio: AsignacionServiceDep, paginacion: PaginacionDep
) -> PaginaSalida[TareaDelDiaSalida]:
    """RF-06: correcciones primero; luego por prioridad y hora límite."""
    pagina = servicio.tareas_de_hoy(actor, paginacion)
    return PaginaSalida[TareaDelDiaSalida].model_validate(pagina, from_attributes=True)


@router.get("")
def listar_asignaciones(
    actor: GestorDep,
    servicio: AsignacionServiceDep,
    paginacion: PaginacionDep,
    fecha: date | None = None,
    propiedad_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> PaginaSalida[AsignacionSalida]:
    pagina = servicio.listar(actor, paginacion, fecha, propiedad_id, empleado_id)
    return PaginaSalida[AsignacionSalida].model_validate(pagina, from_attributes=True)


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_asignacion(
    datos: AsignacionEntrada, actor: GestorDep, servicio: AsignacionServiceDep
) -> AsignacionCreadaSalida:
    """RF-05."""
    asignacion = servicio.crear(
        actor,
        DatosAsignacion(
            habitacion_id=datos.habitacion_id,
            empleado_id=datos.empleado_id,
            fecha=datos.fecha,
            prioridad=datos.prioridad,
            hora_limite=datos.hora_limite,
        ),
    )
    return AsignacionCreadaSalida.model_validate(asignacion)
