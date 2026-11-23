import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import exists, select, update

from app.core.paginacion import Pagina, Paginacion
from app.models import Asignacion, Habitacion, RefreshToken, SupervisorPropiedad, Usuario
from app.models.enums import Rol
from app.repositories.base import RepositorioEmpresa


class UsuarioRepository(RepositorioEmpresa):
    def obtener(self, usuario_id: uuid.UUID) -> Usuario | None:
        return self._sesion.scalar(
            select(Usuario).where(Usuario.id == usuario_id, Usuario.empresa_id == self._empresa_id)
        )

    def por_nombre_para_actualizar(self, nombre_usuario: str) -> Usuario | None:
        return self._sesion.scalar(
            select(Usuario)
            .where(Usuario.nombre_usuario == nombre_usuario, Usuario.empresa_id == self._empresa_id)
            .with_for_update()
        )

    def listar(self, paginacion: Paginacion, rol: Rol | None = None) -> Pagina[Usuario]:
        consulta = (
            select(Usuario)
            .where(Usuario.empresa_id == self._empresa_id)
            .order_by(Usuario.nombre_usuario)
        )
        if rol is not None:
            consulta = consulta.where(Usuario.rol == rol)
        return self._paginar_entidades(consulta, paginacion)

    def cambiar_rol(self, usuario: Usuario, rol: Rol) -> Usuario:
        """El rol define la subclase, así que se actualiza la fila y se recarga la entidad."""
        self._sesion.execute(
            update(Usuario)
            .where(Usuario.id == usuario.id, Usuario.empresa_id == self._empresa_id)
            .values(rol=rol)
            .execution_options(synchronize_session=False)
        )
        self._sesion.flush()
        self._sesion.expunge(usuario)
        recargado = self.obtener(usuario.id)
        if recargado is None:
            raise LookupError("Usuario desaparecido durante la transacción")
        return recargado

    def quitar_de_propiedades(self, usuario_id: uuid.UUID) -> None:
        for fila in self._sesion.scalars(
            select(SupervisorPropiedad).where(SupervisorPropiedad.usuario_id == usuario_id)
        ):
            self._sesion.delete(fila)
        self._sesion.flush()

    def trabaja_en_propiedades(
        self, empleado_id: uuid.UUID, propiedades: Sequence[uuid.UUID]
    ) -> bool:
        """Grupo del supervisor: empleados con asignaciones en sus propiedades."""
        consulta = select(
            exists()
            .where(Asignacion.empleado_id == empleado_id)
            .where(Asignacion.empresa_id == self._empresa_id)
            .where(Asignacion.habitacion_id == Habitacion.id)
            .where(Habitacion.propiedad_id.in_(propiedades))
        )
        return bool(self._sesion.scalar(consulta))


class RefreshTokenRepository(RepositorioEmpresa):
    def por_hash_para_actualizar(self, hash_token: str) -> RefreshToken | None:
        return self._sesion.scalar(
            select(RefreshToken)
            .where(
                RefreshToken.hash_token == hash_token,
                RefreshToken.empresa_id == self._empresa_id,
            )
            .with_for_update()
        )

    def revocar_todos(self, usuario_id: uuid.UUID, ahora: datetime) -> None:
        self._sesion.execute(
            update(RefreshToken)
            .where(
                RefreshToken.usuario_id == usuario_id,
                RefreshToken.empresa_id == self._empresa_id,
                RefreshToken.revocado_en.is_(None),
            )
            .values(revocado_en=ahora)
        )
