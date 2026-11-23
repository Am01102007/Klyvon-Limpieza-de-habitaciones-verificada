import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import func, select

from app.core.paginacion import Pagina, Paginacion
from app.models import Asignacion, Dano, Habitacion, Limpieza, Propiedad, Usuario
from app.models.enums import EstadoDano, EstadoTrabajo, GravedadDano, TipoLimpieza
from app.repositories.base import ConsultaFilas, RepositorioEmpresa


@dataclass(frozen=True)
class FiltroReporte:
    visibles: Sequence[uuid.UUID] | None = None
    desde: date | None = None
    hasta: date | None = None
    propiedad_id: uuid.UUID | None = None
    empleado_id: uuid.UUID | None = None


class ReporteRepository(RepositorioEmpresa):
    def tiempos_por_habitacion(self, filtro: FiltroReporte, paginacion: Paginacion) -> Pagina[Any]:
        consulta = (
            select(
                Habitacion.id.label("habitacion_id"),
                Habitacion.nombre.label("habitacion_nombre"),
                Propiedad.nombre.label("propiedad_nombre"),
                func.avg(Limpieza.duracion_neta_seg).label("promedio_seg"),
                func.count(Limpieza.id).label("limpiezas"),
            )
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Propiedad, Propiedad.id == Habitacion.propiedad_id)
            .group_by(Habitacion.id, Habitacion.nombre, Propiedad.nombre)
            .order_by(Propiedad.nombre, Habitacion.nombre)
        )
        return self._paginar_filas(self._de_tiempos(consulta, filtro), paginacion)

    def tiempos_por_empleado(self, filtro: FiltroReporte, paginacion: Paginacion) -> Pagina[Any]:
        consulta = (
            select(
                Usuario.id.label("empleado_id"),
                Usuario.nombre_usuario.label("empleado_nombre"),
                func.avg(Limpieza.duracion_neta_seg).label("promedio_seg"),
                func.count(Limpieza.id).label("limpiezas"),
            )
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Usuario, Usuario.id == Limpieza.empleado_id)
            .group_by(Usuario.id, Usuario.nombre_usuario)
            .order_by(Usuario.nombre_usuario)
        )
        return self._paginar_filas(self._de_tiempos(consulta, filtro), paginacion)

    def danos_por_propiedad(self, filtro: FiltroReporte, paginacion: Paginacion) -> Pagina[Any]:
        def contar(condicion: Any) -> Any:
            return func.count(Dano.id).filter(condicion)

        consulta = (
            select(
                Propiedad.id.label("propiedad_id"),
                Propiedad.nombre.label("propiedad_nombre"),
                func.count(Dano.id).label("total"),
                contar(Dano.estado == EstadoDano.ABIERTO).label("abiertos"),
                contar(Dano.estado == EstadoDano.EN_REPARACION).label("en_reparacion"),
                contar(Dano.estado == EstadoDano.RESUELTO).label("resueltos"),
                contar(Dano.gravedad == GravedadDano.URGENTE).label("urgentes"),
            )
            .join(Limpieza, Limpieza.id == Dano.limpieza_id)
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Propiedad, Propiedad.id == Habitacion.propiedad_id)
            .where(Dano.empresa_id == self._empresa_id)
            .group_by(Propiedad.id, Propiedad.nombre)
            .order_by(Propiedad.nombre)
        )
        return self._paginar_filas(_filtrar(consulta, filtro), paginacion)

    def _de_tiempos(self, consulta: ConsultaFilas, filtro: FiltroReporte) -> ConsultaFilas:
        """La corrección se mide aparte (HU-12), así que no entra en los promedios."""
        return _filtrar(
            consulta.where(
                Limpieza.empresa_id == self._empresa_id,
                Limpieza.tipo == TipoLimpieza.NORMAL,
                Limpieza.estado_trabajo == EstadoTrabajo.ENVIADA,
            ),
            filtro,
        )


def _filtrar(consulta: ConsultaFilas, filtro: FiltroReporte) -> ConsultaFilas:
    if filtro.visibles is not None:
        consulta = consulta.where(Habitacion.propiedad_id.in_(filtro.visibles))
    if filtro.desde is not None:
        consulta = consulta.where(Asignacion.fecha >= filtro.desde)
    if filtro.hasta is not None:
        consulta = consulta.where(Asignacion.fecha <= filtro.hasta)
    if filtro.propiedad_id is not None:
        consulta = consulta.where(Habitacion.propiedad_id == filtro.propiedad_id)
    if filtro.empleado_id is not None:
        consulta = consulta.where(Limpieza.empleado_id == filtro.empleado_id)
    return consulta
