import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import TipoPropiedad, columna_enum


class Propiedad(Base):
    __tablename__ = "propiedad"
    __table_args__ = (UniqueConstraint("empresa_id", "id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id", ondelete="RESTRICT"))
    nombre: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[TipoPropiedad] = mapped_column(columna_enum(TipoPropiedad, "tipo"))
    direccion: Mapped[str | None] = mapped_column(Text)
    zona_horaria: Mapped[str] = mapped_column(String(64))


class SupervisorPropiedad(Base):
    __tablename__ = "supervisor_propiedad"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "usuario_id"], ["usuario.empresa_id", "usuario.id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["empresa_id", "propiedad_id"],
            ["propiedad.empresa_id", "propiedad.id"],
            ondelete="CASCADE",
        ),
    )

    usuario_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    propiedad_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, index=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column()


class Habitacion(Base):
    __tablename__ = "habitacion"
    __table_args__ = (
        UniqueConstraint("propiedad_id", "nombre"),
        UniqueConstraint("empresa_id", "id"),
        ForeignKeyConstraint(
            ["empresa_id", "propiedad_id"],
            ["propiedad.empresa_id", "propiedad.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("fotos_min_entrada >= 1", name="fotos_min_entrada_positivo"),
        CheckConstraint("fotos_min_salida >= 1", name="fotos_min_salida_positivo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    propiedad_id: Mapped[uuid.UUID] = mapped_column()
    nombre: Mapped[str] = mapped_column(String(60))
    tipo: Mapped[str | None] = mapped_column(String(60))
    fotos_min_entrada: Mapped[int] = mapped_column(SmallInteger, default=1)
    fotos_min_salida: Mapped[int] = mapped_column(SmallInteger, default=1)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
