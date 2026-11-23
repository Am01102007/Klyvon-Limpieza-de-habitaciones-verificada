import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import Idioma, ReglaRevision, columna_enum


class Empresa(Base):
    __tablename__ = "empresa"
    __table_args__ = (
        CheckConstraint("muestra_n >= 1", name="muestra_n_positivo"),
        CheckConstraint("retencion_fotos_dias >= 1", name="retencion_positiva"),
        CheckConstraint("codigo = upper(codigo)", name="codigo_mayusculas"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(120))
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    idioma: Mapped[Idioma] = mapped_column(columna_enum(Idioma, "idioma"), default=Idioma.ES)
    plan: Mapped[str] = mapped_column(String(30), default="basico")
    regla_revision: Mapped[ReglaRevision] = mapped_column(
        columna_enum(ReglaRevision, "regla_revision"), default=ReglaRevision.TODO
    )
    muestra_n: Mapped[int] = mapped_column(SmallInteger, default=5)
    retencion_fotos_dias: Mapped[int] = mapped_column(SmallInteger, default=90)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
