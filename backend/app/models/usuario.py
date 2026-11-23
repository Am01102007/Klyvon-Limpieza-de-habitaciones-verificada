import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import Idioma, Rol, TipoClave, columna_enum


class Usuario(Base):
    """Clase abstracta del diagrama de clases: tabla única con la columna `rol`."""

    __tablename__ = "usuario"
    __table_args__ = (
        UniqueConstraint("empresa_id", "nombre_usuario"),
        UniqueConstraint("empresa_id", "id"),
        CheckConstraint("intentos_fallidos >= 0", name="intentos_no_negativos"),
        CheckConstraint("tipo_clave = 'contrasena' OR rol = 'empleado'", name="pin_solo_empleados"),
    )
    __mapper_args__ = {"polymorphic_on": "rol", "polymorphic_abstract": True}  # noqa: RUF012

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id", ondelete="RESTRICT"))
    nombre_usuario: Mapped[str] = mapped_column(String(60))
    hash_clave: Mapped[str] = mapped_column(String(255))
    tipo_clave: Mapped[TipoClave] = mapped_column(columna_enum(TipoClave, "tipo_clave"))
    rol: Mapped[Rol] = mapped_column(columna_enum(Rol, "rol"))
    idioma: Mapped[Idioma] = mapped_column(columna_enum(Idioma, "idioma"))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    intentos_fallidos: Mapped[int] = mapped_column(SmallInteger, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def esta_bloqueado(self, ahora: datetime) -> bool:
        return self.bloqueado_hasta is not None and self.bloqueado_hasta > ahora


class Empleado(Usuario):
    __mapper_args__ = {"polymorphic_identity": Rol.EMPLEADO}  # noqa: RUF012


class Supervisor(Usuario):
    __mapper_args__ = {"polymorphic_identity": Rol.SUPERVISOR}  # noqa: RUF012


class Administrador(Usuario):
    __mapper_args__ = {"polymorphic_identity": Rol.ADMIN}  # noqa: RUF012


CLASE_POR_ROL: dict[Rol, type[Usuario]] = {
    Rol.EMPLEADO: Empleado,
    Rol.SUPERVISOR: Supervisor,
    Rol.ADMIN: Administrador,
}


class RefreshToken(Base):
    """Solo guarda el hash del token, para poder rotarlo y revocarlo."""

    __tablename__ = "refresh_token"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "usuario_id"], ["usuario.empresa_id", "usuario.id"], ondelete="CASCADE"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    usuario_id: Mapped[uuid.UUID] = mapped_column(index=True)
    hash_token: Mapped[str] = mapped_column(String(64), unique=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revocado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
