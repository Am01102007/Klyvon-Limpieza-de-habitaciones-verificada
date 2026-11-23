import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select

from app.core.paginacion import Pagina, Paginacion
from app.models import (
    Asignacion,
    Dano,
    Foto,
    Habitacion,
    Limpieza,
    Pausa,
    Propiedad,
    Revision,
    Usuario,
)
from app.models.enums import EstadoRevision, EstadoTrabajo, MomentoFoto, TipoLimpieza
from app.repositories.base import RepositorioEmpresa


@dataclass(frozen=True)
class ContextoLimpieza:
    limpieza: Limpieza
    habitacion: Habitacion
    fecha: date
    zona_horaria: str


class LimpiezaRepository(RepositorioEmpresa):
    def obtener_contexto(
        self, limpieza_id: uuid.UUID, para_actualizar: bool = False
    ) -> ContextoLimpieza | None:
        consulta = (
            select(Limpieza, Habitacion, Asignacion.fecha, Propiedad.zona_horaria)
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Propiedad, Propiedad.id == Habitacion.propiedad_id)
            .where(Limpieza.id == limpieza_id, Limpieza.empresa_id == self._empresa_id)
        )
        if para_actualizar:
            consulta = consulta.with_for_update(of=Limpieza)
        fila = self._sesion.execute(consulta).one_or_none()
        if fila is None:
            return None
        return ContextoLimpieza(fila[0], fila[1], fila[2], fila[3])

    def listar(
        self,
        paginacion: Paginacion,
        visibles: Sequence[uuid.UUID] | None,
        estado_revision: EstadoRevision | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
        desde: date | None,
        hasta: date | None,
    ) -> Pagina[Any]:
        consulta = (
            select(
                Limpieza.id,
                Limpieza.asignacion_id,
                Limpieza.empleado_id,
                Limpieza.tipo,
                Limpieza.limpieza_origen_id,
                Limpieza.inicio,
                Limpieza.fin,
                Limpieza.duracion_neta_seg,
                Limpieza.estado_trabajo,
                Limpieza.requiere_revision,
                Limpieza.estado_revision,
                Asignacion.fecha,
                Habitacion.id.label("habitacion_id"),
                Habitacion.nombre.label("habitacion_nombre"),
                Habitacion.propiedad_id,
                Usuario.nombre_usuario.label("empleado_nombre"),
            )
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .join(Usuario, Usuario.id == Limpieza.empleado_id)
            .where(Limpieza.empresa_id == self._empresa_id)
            .order_by(Limpieza.fin.asc().nulls_last(), Limpieza.id)
        )
        if visibles is not None:
            consulta = consulta.where(Habitacion.propiedad_id.in_(visibles))
        if estado_revision is not None:
            consulta = consulta.where(Limpieza.estado_revision == estado_revision)
        if propiedad_id is not None:
            consulta = consulta.where(Habitacion.propiedad_id == propiedad_id)
        if empleado_id is not None:
            consulta = consulta.where(Limpieza.empleado_id == empleado_id)
        if desde is not None:
            consulta = consulta.where(Asignacion.fecha >= desde)
        if hasta is not None:
            consulta = consulta.where(Asignacion.fecha <= hasta)
        return self._paginar_filas(consulta, paginacion)

    def tiene_otra_abierta(self, empleado_id: uuid.UUID) -> bool:
        return (
            self._sesion.scalar(
                select(Limpieza.id).where(
                    Limpieza.empleado_id == empleado_id,
                    Limpieza.empresa_id == self._empresa_id,
                    Limpieza.estado_trabajo == EstadoTrabajo.EN_CURSO,
                )
            )
            is not None
        )

    def promedio_duracion_habitacion(
        self, habitacion_id: uuid.UUID, excluir: uuid.UUID
    ) -> float | None:
        promedio = self._sesion.scalar(
            select(func.avg(Limpieza.duracion_neta_seg))
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .where(
                Asignacion.habitacion_id == habitacion_id,
                Limpieza.id != excluir,
                Limpieza.empresa_id == self._empresa_id,
                Limpieza.tipo == TipoLimpieza.NORMAL,
                Limpieza.estado_trabajo == EstadoTrabajo.ENVIADA,
            )
        )
        return None if promedio is None else float(promedio)

    def obtener_foto(self, foto_id: uuid.UUID) -> Foto | None:
        return self._sesion.scalar(
            select(Foto).where(Foto.id == foto_id, Foto.empresa_id == self._empresa_id)
        )

    def fotos(self, limpieza_id: uuid.UUID) -> Sequence[Foto]:
        return self._sesion.scalars(
            select(Foto)
            .where(Foto.limpieza_id == limpieza_id, Foto.empresa_id == self._empresa_id)
            .order_by(Foto.tomada_en)
        ).all()

    def contar_fotos(self, limpieza_id: uuid.UUID, momento: MomentoFoto) -> int:
        return (
            self._sesion.scalar(
                select(func.count())
                .select_from(Foto)
                .where(
                    Foto.limpieza_id == limpieza_id,
                    Foto.empresa_id == self._empresa_id,
                    Foto.momento == momento,
                )
            )
            or 0
        )

    def ultima_foto_salida(self, limpieza_id: uuid.UUID) -> datetime | None:
        return self._sesion.scalar(
            select(func.max(Foto.tomada_en)).where(
                Foto.limpieza_id == limpieza_id,
                Foto.empresa_id == self._empresa_id,
                Foto.momento == MomentoFoto.SALIDA,
            )
        )

    def obtener_pausa(self, pausa_id: uuid.UUID) -> Pausa | None:
        return self._sesion.scalar(
            select(Pausa).where(Pausa.id == pausa_id, Pausa.empresa_id == self._empresa_id)
        )

    def pausas(self, limpieza_id: uuid.UUID) -> Sequence[Pausa]:
        return self._sesion.scalars(
            select(Pausa)
            .where(Pausa.limpieza_id == limpieza_id, Pausa.empresa_id == self._empresa_id)
            .order_by(Pausa.inicio)
        ).all()

    def pausa_abierta(self, limpieza_id: uuid.UUID) -> Pausa | None:
        return self._sesion.scalar(
            select(Pausa).where(
                Pausa.limpieza_id == limpieza_id,
                Pausa.empresa_id == self._empresa_id,
                Pausa.fin.is_(None),
            )
        )

    def obtener_dano(self, dano_id: uuid.UUID) -> Dano | None:
        return self._sesion.scalar(
            select(Dano).where(Dano.id == dano_id, Dano.empresa_id == self._empresa_id)
        )

    def danos(self, limpieza_id: uuid.UUID) -> Sequence[Dano]:
        return self._sesion.scalars(
            select(Dano)
            .where(Dano.limpieza_id == limpieza_id, Dano.empresa_id == self._empresa_id)
            .order_by(Dano.creado_en)
        ).all()

    def revision_de(self, limpieza_id: uuid.UUID) -> Revision | None:
        return self._sesion.scalar(
            select(Revision).where(
                Revision.limpieza_id == limpieza_id, Revision.empresa_id == self._empresa_id
            )
        )
