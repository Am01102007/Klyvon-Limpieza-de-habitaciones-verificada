import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import or_, select

from app.core.paginacion import Pagina, Paginacion
from app.models import Asignacion, Dano, DanoHistorial, Foto, Habitacion, Limpieza
from app.models.enums import EstadoDano
from app.repositories.base import RepositorioEmpresa


@dataclass(frozen=True)
class DanoConPropiedad:
    dano: Dano
    propiedad_id: uuid.UUID


class DanoRepository(RepositorioEmpresa):
    def obtener(self, dano_id: uuid.UUID, para_actualizar: bool = False) -> DanoConPropiedad | None:
        consulta = (
            select(Dano, Habitacion.propiedad_id)
            .join(Limpieza, Limpieza.id == Dano.limpieza_id)
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .where(Dano.id == dano_id, Dano.empresa_id == self._empresa_id)
        )
        if para_actualizar:
            consulta = consulta.with_for_update(of=Dano)
        fila = self._sesion.execute(consulta).one_or_none()
        return None if fila is None else DanoConPropiedad(fila[0], fila[1])

    def listar(
        self,
        paginacion: Paginacion,
        visibles: Sequence[uuid.UUID] | None,
        estado: EstadoDano | None,
        propiedad_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        consulta = (
            select(
                Dano.id,
                Dano.limpieza_id,
                Dano.categoria,
                Dano.gravedad,
                Dano.nota,
                Dano.estado,
                Dano.creado_en,
                Habitacion.id.label("habitacion_id"),
                Habitacion.nombre.label("habitacion_nombre"),
                Habitacion.propiedad_id,
            )
            .join(Limpieza, Limpieza.id == Dano.limpieza_id)
            .join(Asignacion, Asignacion.id == Limpieza.asignacion_id)
            .join(Habitacion, Habitacion.id == Asignacion.habitacion_id)
            .where(Dano.empresa_id == self._empresa_id)
            .order_by(Dano.creado_en.desc(), Dano.id)
        )
        if visibles is not None:
            consulta = consulta.where(Habitacion.propiedad_id.in_(visibles))
        if estado is not None:
            consulta = consulta.where(Dano.estado == estado)
        if propiedad_id is not None:
            consulta = consulta.where(Habitacion.propiedad_id == propiedad_id)
        return self._paginar_filas(consulta, paginacion)

    def historial(self, dano_id: uuid.UUID) -> Sequence[DanoHistorial]:
        return self._sesion.scalars(
            select(DanoHistorial)
            .where(DanoHistorial.dano_id == dano_id, DanoHistorial.empresa_id == self._empresa_id)
            .order_by(DanoHistorial.cambiado_en)
        ).all()

    def fotos(self, dano_id: uuid.UUID) -> Sequence[Foto]:
        return self._sesion.scalars(
            select(Foto)
            .where(Foto.dano_id == dano_id, Foto.empresa_id == self._empresa_id)
            .order_by(Foto.tomada_en)
        ).all()


class FotoVencidaRepository(RepositorioEmpresa):
    def vencidas(self, antes_de: datetime, limite: int) -> Sequence[Foto]:
        """CU-15: se conservan las fotos de daños sin resolver."""
        return self._sesion.scalars(
            select(Foto)
            .outerjoin(Dano, Dano.id == Foto.dano_id)
            .where(
                Foto.empresa_id == self._empresa_id,
                Foto.tomada_en < antes_de,
                or_(Foto.dano_id.is_(None), Dano.estado == EstadoDano.RESUELTO),
            )
            .limit(limite)
        ).all()

    def eliminar(self, foto: Foto) -> None:
        self._sesion.delete(foto)
        self._sesion.flush()
