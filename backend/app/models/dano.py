import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import CategoriaDano, EstadoDano, GravedadDano, MomentoFoto, columna_enum


class Dano(Base):
    __tablename__ = "dano"
    __table_args__ = (
        UniqueConstraint("empresa_id", "id"),
        ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            ondelete="RESTRICT",
        ),
        Index("ix_dano_limpieza_id", "limpieza_id"),
        Index("ix_dano_estado", "estado"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    limpieza_id: Mapped[uuid.UUID] = mapped_column()
    categoria: Mapped[CategoriaDano] = mapped_column(columna_enum(CategoriaDano, "categoria"))
    gravedad: Mapped[GravedadDano] = mapped_column(columna_enum(GravedadDano, "gravedad"))
    nota: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[EstadoDano] = mapped_column(
        columna_enum(EstadoDano, "estado"), default=EstadoDano.ABIERTO
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DanoHistorial(Base):
    __tablename__ = "dano_historial"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "dano_id"], ["dano.empresa_id", "dano.id"], ondelete="RESTRICT"
        ),
        ForeignKeyConstraint(
            ["empresa_id", "usuario_id"], ["usuario.empresa_id", "usuario.id"], ondelete="RESTRICT"
        ),
        Index("ix_dano_historial_dano_id", "dano_id"),
        Index("ix_dano_historial_usuario_id", "usuario_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    dano_id: Mapped[uuid.UUID] = mapped_column()
    usuario_id: Mapped[uuid.UUID] = mapped_column()
    estado_anterior: Mapped[EstadoDano] = mapped_column(columna_enum(EstadoDano, "estado_anterior"))
    estado_nuevo: Mapped[EstadoDano] = mapped_column(columna_enum(EstadoDano, "estado_nuevo"))
    cambiado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Foto(Base):
    """`url` guarda la clave de almacenamiento; al cliente solo llegan URLs firmadas."""

    __tablename__ = "foto"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["empresa_id", "dano_id"], ["dano.empresa_id", "dano.id"], ondelete="RESTRICT"
        ),
        CheckConstraint("(momento = 'dano') = (dano_id IS NOT NULL)", name="dano_solo_si_momento"),
        CheckConstraint("tamano_kb > 0", name="tamano_positivo"),
        Index("ix_foto_limpieza_id", "limpieza_id"),
        Index("ix_foto_dano_id", "dano_id"),
        Index("ix_foto_tomada_en", "tomada_en"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    limpieza_id: Mapped[uuid.UUID] = mapped_column()
    dano_id: Mapped[uuid.UUID | None] = mapped_column()
    momento: Mapped[MomentoFoto] = mapped_column(columna_enum(MomentoFoto, "momento"))
    url: Mapped[str] = mapped_column(Text)
    tomada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    tamano_kb: Mapped[int] = mapped_column(Integer)
