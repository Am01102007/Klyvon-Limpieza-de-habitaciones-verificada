import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Empresa


class EmpresaRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def id_por_codigo(self, codigo: str) -> uuid.UUID | None:
        """El login aún no conoce la empresa; la función de la base expone solo el id."""
        return self._sesion.scalar(select(func.empresa_id_por_codigo(codigo)))

    def todos_los_ids(self) -> Sequence[uuid.UUID]:
        return self._sesion.scalars(select(func.empresas_ids())).all()

    def obtener(self, empresa_id: uuid.UUID) -> Empresa | None:
        return self._sesion.scalar(select(Empresa).where(Empresa.id == empresa_id))
