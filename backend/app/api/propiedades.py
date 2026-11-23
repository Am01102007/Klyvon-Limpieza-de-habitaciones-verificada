import uuid

from fastapi import APIRouter, status

from app.api.dependencias import AdminDep, GestorDep, PaginacionDep, PropiedadServiceDep
from app.api.schemas import (
    HabitacionCambios,
    HabitacionEntrada,
    HabitacionSalida,
    PaginaSalida,
    PropiedadCambios,
    PropiedadEntrada,
    PropiedadSalida,
    SupervisorVinculo,
    UsuarioSalida,
)
from app.services.propiedades import CambiosHabitacion, CambiosPropiedad, DatosHabitacion

router = APIRouter(tags=["propiedades y habitaciones"])


@router.get("/propiedades")
def listar_propiedades(
    actor: GestorDep, servicio: PropiedadServiceDep, paginacion: PaginacionDep
) -> PaginaSalida[PropiedadSalida]:
    pagina = servicio.listar(actor, paginacion)
    return PaginaSalida[PropiedadSalida].model_validate(pagina, from_attributes=True)


@router.post("/propiedades", status_code=status.HTTP_201_CREATED)
def crear_propiedad(
    datos: PropiedadEntrada, actor: AdminDep, servicio: PropiedadServiceDep
) -> PropiedadSalida:
    """RF-04."""
    propiedad = servicio.crear(actor, datos.nombre, datos.tipo, datos.direccion, datos.zona_horaria)
    return PropiedadSalida.model_validate(propiedad)


@router.get("/propiedades/{propiedad_id}")
def consultar_propiedad(
    propiedad_id: uuid.UUID, actor: GestorDep, servicio: PropiedadServiceDep
) -> PropiedadSalida:
    return PropiedadSalida.model_validate(servicio.obtener(actor, propiedad_id))


@router.patch("/propiedades/{propiedad_id}")
def editar_propiedad(
    propiedad_id: uuid.UUID,
    datos: PropiedadCambios,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
) -> PropiedadSalida:
    cambios = CambiosPropiedad(**datos.model_dump(exclude_unset=True))
    return PropiedadSalida.model_validate(servicio.actualizar(actor, propiedad_id, cambios))


@router.get("/propiedades/{propiedad_id}/supervisores")
def listar_supervisores(
    propiedad_id: uuid.UUID,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
    paginacion: PaginacionDep,
) -> PaginaSalida[UsuarioSalida]:
    pagina = servicio.supervisores(actor, propiedad_id, paginacion)
    return PaginaSalida[UsuarioSalida].model_validate(pagina, from_attributes=True)


@router.post("/propiedades/{propiedad_id}/supervisores", status_code=status.HTTP_204_NO_CONTENT)
def vincular_supervisor(
    propiedad_id: uuid.UUID,
    datos: SupervisorVinculo,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
) -> None:
    servicio.vincular_supervisor(actor, propiedad_id, datos.usuario_id)


@router.delete(
    "/propiedades/{propiedad_id}/supervisores/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def desvincular_supervisor(
    propiedad_id: uuid.UUID,
    usuario_id: uuid.UUID,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
) -> None:
    servicio.desvincular_supervisor(actor, propiedad_id, usuario_id)


@router.get("/propiedades/{propiedad_id}/habitaciones")
def listar_habitaciones(
    propiedad_id: uuid.UUID,
    actor: GestorDep,
    servicio: PropiedadServiceDep,
    paginacion: PaginacionDep,
) -> PaginaSalida[HabitacionSalida]:
    pagina = servicio.listar_habitaciones(actor, propiedad_id, paginacion)
    return PaginaSalida[HabitacionSalida].model_validate(pagina, from_attributes=True)


@router.post("/propiedades/{propiedad_id}/habitaciones", status_code=status.HTTP_201_CREATED)
def crear_habitacion(
    propiedad_id: uuid.UUID,
    datos: HabitacionEntrada,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
) -> HabitacionSalida:
    """RF-04, HU-03: fotos mínimas configurables por habitación."""
    habitacion = servicio.crear_habitacion(
        actor,
        propiedad_id,
        DatosHabitacion(
            nombre=datos.nombre,
            tipo=datos.tipo,
            fotos_min_entrada=datos.fotos_min_entrada,
            fotos_min_salida=datos.fotos_min_salida,
        ),
    )
    return HabitacionSalida.model_validate(habitacion)


@router.get("/habitaciones/{habitacion_id}")
def consultar_habitacion(
    habitacion_id: uuid.UUID, actor: GestorDep, servicio: PropiedadServiceDep
) -> HabitacionSalida:
    return HabitacionSalida.model_validate(servicio.obtener_habitacion(actor, habitacion_id))


@router.patch("/habitaciones/{habitacion_id}")
def editar_habitacion(
    habitacion_id: uuid.UUID,
    datos: HabitacionCambios,
    actor: AdminDep,
    servicio: PropiedadServiceDep,
) -> HabitacionSalida:
    cambios = CambiosHabitacion(**datos.model_dump(exclude_unset=True))
    return HabitacionSalida.model_validate(
        servicio.actualizar_habitacion(actor, habitacion_id, cambios)
    )
