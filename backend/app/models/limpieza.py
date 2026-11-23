import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    SmallInteger,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import (
    EstadoRevision,
    EstadoTrabajo,
    MotivoPausa,
    ResultadoRevision,
    TipoLimpieza,
    columna_enum,
)


class Asignacion(Base):
    __tablename__ = "asignacion"
    __table_args__ = (
        UniqueConstraint("empresa_id", "id", "empleado_id"),
        UniqueConstraint("habitacion_id", "fecha", "empleado_id"),
        ForeignKeyConstraint(
            ["empresa_id", "habitacion_id"],
            ["habitacion.empresa_id", "habitacion.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["empresa_id", "empleado_id"], ["usuario.empresa_id", "usuario.id"], ondelete="RESTRICT"
        ),
        ForeignKeyConstraint(
            ["empresa_id", "asignado_por"],
            ["usuario.empresa_id", "usuario.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("prioridad >= 1", name="prioridad_positiva"),
        Index("ix_asignacion_empleado_id_fecha", "empleado_id", "fecha"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    habitacion_id: Mapped[uuid.UUID] = mapped_column()
    empleado_id: Mapped[uuid.UUID] = mapped_column()
    asignado_por: Mapped[uuid.UUID] = mapped_column(index=True)
    fecha: Mapped[date] = mapped_column(Date)
    prioridad: Mapped[int] = mapped_column(SmallInteger, default=1)
    hora_limite: Mapped[time | None] = mapped_column(Time)


class Limpieza(Base):
    __tablename__ = "limpieza"
    __table_args__ = (
        UniqueConstraint("empresa_id", "id"),
        ForeignKeyConstraint(
            ["empresa_id", "asignacion_id", "empleado_id"],
            ["asignacion.empresa_id", "asignacion.id", "asignacion.empleado_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["empresa_id", "limpieza_origen_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("fin > inicio", name="fin_posterior_a_inicio"),
        CheckConstraint("duracion_neta_seg >= 0", name="duracion_no_negativa"),
        CheckConstraint(
            "(tipo = 'normal') = (limpieza_origen_id IS NULL)", name="origen_solo_en_correccion"
        ),
        CheckConstraint(
            "(estado_trabajo = 'pendiente' AND inicio IS NULL AND fin IS NULL"
            " AND duracion_neta_seg IS NULL)"
            " OR (estado_trabajo = 'en_curso' AND inicio IS NOT NULL AND fin IS NULL"
            " AND duracion_neta_seg IS NULL)"
            " OR (estado_trabajo = 'enviada' AND inicio IS NOT NULL AND fin IS NOT NULL"
            " AND duracion_neta_seg IS NOT NULL)",
            name="tiempos_segun_estado",
        ),
        Index(
            "uq_limpieza_empleado_abierta",
            "empleado_id",
            unique=True,
            postgresql_where=text("estado_trabajo = 'en_curso'"),
        ),
        Index(
            "uq_limpieza_normal_por_asignacion",
            "asignacion_id",
            unique=True,
            postgresql_where=text("tipo = 'normal'"),
        ),
        Index(
            "uq_limpieza_correccion_por_origen",
            "limpieza_origen_id",
            unique=True,
            postgresql_where=text("limpieza_origen_id IS NOT NULL"),
        ),
        Index("ix_limpieza_asignacion_id", "asignacion_id"),
        Index("ix_limpieza_estado_revision", "estado_revision"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    asignacion_id: Mapped[uuid.UUID] = mapped_column()
    empleado_id: Mapped[uuid.UUID] = mapped_column()
    tipo: Mapped[TipoLimpieza] = mapped_column(
        columna_enum(TipoLimpieza, "tipo"), default=TipoLimpieza.NORMAL
    )
    limpieza_origen_id: Mapped[uuid.UUID | None] = mapped_column()
    inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duracion_neta_seg: Mapped[int | None] = mapped_column(Integer)
    estado_trabajo: Mapped[EstadoTrabajo] = mapped_column(
        columna_enum(EstadoTrabajo, "estado_trabajo"), default=EstadoTrabajo.PENDIENTE
    )
    requiere_revision: Mapped[bool] = mapped_column(Boolean, default=False)
    estado_revision: Mapped[EstadoRevision] = mapped_column(
        columna_enum(EstadoRevision, "estado_revision"), default=EstadoRevision.NO_REQUERIDA
    )


class Pausa(Base):
    __tablename__ = "pausa"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("fin >= inicio", name="fin_no_anterior_a_inicio"),
        Index(
            "uq_pausa_abierta_por_limpieza",
            "limpieza_id",
            unique=True,
            postgresql_where=text("fin IS NULL"),
        ),
        Index("ix_pausa_limpieza_id", "limpieza_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    limpieza_id: Mapped[uuid.UUID] = mapped_column()
    motivo: Mapped[MotivoPausa] = mapped_column(columna_enum(MotivoPausa, "motivo"))
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Revision(Base):
    __tablename__ = "revision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["empresa_id", "limpieza_id"],
            ["limpieza.empresa_id", "limpieza.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["empresa_id", "supervisor_id"],
            ["usuario.empresa_id", "usuario.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "resultado <> 'rechazada' OR length(trim(comentario)) > 0",
            name="comentario_si_rechaza",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    empresa_id: Mapped[uuid.UUID] = mapped_column()
    limpieza_id: Mapped[uuid.UUID] = mapped_column(unique=True)
    supervisor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    resultado: Mapped[ResultadoRevision] = mapped_column(
        columna_enum(ResultadoRevision, "resultado")
    )
    comentario: Mapped[str | None] = mapped_column(Text)
    revisado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
