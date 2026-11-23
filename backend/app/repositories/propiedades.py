import uuid
from collections.abc import Sequence

from sqlalchemy import select

from app.core.paginacion import Pagina, Paginacion
from app.models import Habitacion, Propiedad, SupervisorPropiedad, Usuario
from app.repositories.base import RepositorioEmpresa


class PropiedadRepository(RepositorioEmpresa):
    def obtener(self, propiedad_id: uuid.UUID) -> Propiedad | None:
        return self._sesion.scalar(
            select(Propiedad).where(
                Propiedad.id == propiedad_id, Propiedad.empresa_id == self._empresa_id
            )
        )

    def listar(
        self, paginacion: Paginacion, visibles: Sequence[uuid.UUID] | None
    ) -> Pagina[Propiedad]:
        consulta = (
            select(Propiedad)
            .where(Propiedad.empresa_id == self._empresa_id)
            .order_by(Propiedad.nombre)
        )
        if visibles is not None:
            consulta = consulta.where(Propiedad.id.in_(visibles))
        return self._paginar_entidades(consulta, paginacion)

    def ids_de_supervisor(self, usuario_id: uuid.UUID) -> Sequence[uuid.UUID]:
        return self._sesion.scalars(
            select(SupervisorPropiedad.propiedad_id).where(
                SupervisorPropiedad.usuario_id == usuario_id,
                SupervisorPropiedad.empresa_id == self._empresa_id,
            )
        ).all()

    def supervisores(self, propiedad_id: uuid.UUID, paginacion: Paginacion) -> Pagina[Usuario]:
        consulta = (
            select(Usuario)
            .join(SupervisorPropiedad, SupervisorPropiedad.usuario_id == Usuario.id)
            .where(
                SupervisorPropiedad.propiedad_id == propiedad_id,
                Usuario.empresa_id == self._empresa_id,
            )
            .order_by(Usuario.nombre_usuario)
        )
        return self._paginar_entidades(consulta, paginacion)

    def vinculo_supervisor(
        self, propiedad_id: uuid.UUID, usuario_id: uuid.UUID
    ) -> SupervisorPropiedad | None:
        return self._sesion.scalar(
            select(SupervisorPropiedad).where(
                SupervisorPropiedad.propiedad_id == propiedad_id,
                SupervisorPropiedad.usuario_id == usuario_id,
                SupervisorPropiedad.empresa_id == self._empresa_id,
            )
        )

    def eliminar_vinculo(self, vinculo: SupervisorPropiedad) -> None:
        self._sesion.delete(vinculo)
        self._sesion.flush()

    def obtener_habitacion(self, habitacion_id: uuid.UUID) -> Habitacion | None:
        return self._sesion.scalar(
            select(Habitacion).where(
                Habitacion.id == habitacion_id, Habitacion.empresa_id == self._empresa_id
            )
        )

    def listar_habitaciones(
        self, propiedad_id: uuid.UUID, paginacion: Paginacion
    ) -> Pagina[Habitacion]:
        consulta = (
            select(Habitacion)
            .where(
                Habitacion.propiedad_id == propiedad_id,
                Habitacion.empresa_id == self._empresa_id,
            )
            .order_by(Habitacion.nombre)
        )
        return self._paginar_entidades(consulta, paginacion)
