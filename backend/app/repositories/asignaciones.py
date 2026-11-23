import uuid
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, case, cast, func, or_, select
from sqlalchemy.orm import aliased

from app.core.paginacion import Pagina, Paginacion
from app.models import Asignacion, Habitacion, Limpieza, Propiedad, Revision, Usuario
from app.models.enums import EstadoTrabajo, TipoLimpieza
from app.repositories.base import RepositorioEmpresa


class AsignacionRepository(RepositorioEmpresa):
    def listar(
        self,
        paginacion: Paginacion,
        visibles: Sequence[uuid.UUID] | None,
        fecha: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        consulta = (
            select(
                Asignacion.id,
                Asignacion.habitacion_id,
                Asignacion.empleado_id,
                Asignacion.asignado_por,
                Asignacion.fecha,
                Asignacion.prioridad,
                Asignacion.hora_limite,
                Habitacion.nombre.label("habitacion_nombre"),
                Habitacion.propiedad_id,
                Usuario.nombre_usuario.label("empleado_nombre"),
            )
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Usuario, Usuario.id == Asignacion.empleado_id)
            .where(Asignacion.empresa_id == self._empresa_id)
            .order_by(Asignacion.fecha.desc(), Asignacion.prioridad, Asignacion.id)
        )
        if visibles is not None:
            consulta = consulta.where(Habitacion.propiedad_id.in_(visibles))
        if fecha is not None:
            consulta = consulta.where(Asignacion.fecha == fecha)
        if propiedad_id is not None:
            consulta = consulta.where(Habitacion.propiedad_id == propiedad_id)
        if empleado_id is not None:
            consulta = consulta.where(Asignacion.empleado_id == empleado_id)
        return self._paginar_filas(consulta, paginacion)

    def tareas_de_hoy(
        self, empleado_id: uuid.UUID, ahora: datetime, paginacion: Paginacion
    ) -> Pagina[Any]:
        """HU-05 y HU-12: "hoy" se calcula en la zona de cada propiedad y las
        correcciones pendientes van primero, aunque vengan de otro día."""
        hoy_en_propiedad = cast(func.timezone(Propiedad.zona_horaria, ahora), Date)
        revision_origen = aliased(Revision)
        es_correccion_abierta = (Limpieza.tipo == TipoLimpieza.CORRECCION) & (
            Limpieza.estado_trabajo != EstadoTrabajo.ENVIADA
        )
        consulta = (
            select(
                Limpieza.id.label("limpieza_id"),
                Limpieza.tipo,
                Limpieza.estado_trabajo,
                Limpieza.estado_revision,
                Limpieza.inicio,
                Asignacion.id.label("asignacion_id"),
                Asignacion.fecha,
                Asignacion.prioridad,
                Asignacion.hora_limite,
                Habitacion.id.label("habitacion_id"),
                Habitacion.nombre.label("habitacion_nombre"),
                Habitacion.fotos_min_entrada,
                Habitacion.fotos_min_salida,
                Propiedad.nombre.label("propiedad_nombre"),
                Propiedad.zona_horaria,
                revision_origen.comentario.label("comentario_rechazo"),
            )
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Propiedad, Propiedad.id == Habitacion.propiedad_id)
            .outerjoin(revision_origen, revision_origen.limpieza_id == Limpieza.limpieza_origen_id)
            .where(
                Limpieza.empleado_id == empleado_id,
                Limpieza.empresa_id == self._empresa_id,
                or_(Asignacion.fecha == hoy_en_propiedad, es_correccion_abierta),
            )
            .order_by(
                case((es_correccion_abierta, 0), else_=1),
                Asignacion.prioridad,
                Asignacion.hora_limite.asc().nulls_last(),
                Limpieza.id,
            )
        )
        return self._paginar_filas(consulta, paginacion)
