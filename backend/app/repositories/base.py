import uuid
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto
from app.core.paginacion import Pagina, Paginacion
from app.models.base import Base

ConsultaFilas = Select[*tuple[Any, ...]]


class RepositorioEmpresa:
    """Toda consulta filtra por `empresa_id`; RLS es la segunda barrera (RNF-08)."""

    def __init__(self, sesion: Session, empresa_id: uuid.UUID) -> None:
        self._sesion = sesion
        self._empresa_id = empresa_id

    def agregar[E: Base](self, entidad: E, codigo_conflicto: str = "conflicto") -> E:
        self._sesion.add(entidad)
        self.guardar(codigo_conflicto)
        return entidad

    def guardar(self, codigo_conflicto: str = "conflicto") -> None:
        try:
            self._sesion.flush()
        except IntegrityError as error:
            raise Conflicto(codigo_conflicto) from error

    def _paginar_entidades[E](self, consulta: Select[E], paginacion: Paginacion) -> Pagina[E]:
        return Pagina(
            items=self._sesion.scalars(_recortar(consulta, paginacion)).all(),
            total=self._contar(consulta),
            limite=paginacion.limite,
            desplazamiento=paginacion.desplazamiento,
        )

    def _paginar_filas(self, consulta: ConsultaFilas, paginacion: Paginacion) -> Pagina[Any]:
        return Pagina(
            items=self._sesion.execute(_recortar(consulta, paginacion)).all(),
            total=self._contar(consulta),
            limite=paginacion.limite,
            desplazamiento=paginacion.desplazamiento,
        )

    def _contar(self, consulta: ConsultaFilas) -> int:
        conteo = select(func.count()).select_from(consulta.order_by(None).subquery())
        return self._sesion.scalar(conteo) or 0


def _recortar[T: ConsultaFilas](consulta: T, paginacion: Paginacion) -> T:
    return consulta.limit(paginacion.limite).offset(paginacion.desplazamiento)
