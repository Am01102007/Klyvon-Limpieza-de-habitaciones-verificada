import uuid
from datetime import date
from typing import Any

from app.core.exceptions import NoEncontrado
from app.core.paginacion import Pagina, Paginacion
from app.models import Usuario
from app.repositories.propiedades import PropiedadRepository
from app.repositories.reportes import FiltroReporte, ReporteRepository
from app.services.alcance import exigir_propiedad_visible, propiedades_visibles


class ReporteService:
    def __init__(self, reportes: ReporteRepository, propiedades: PropiedadRepository) -> None:
        self._reportes = reportes
        self._propiedades = propiedades

    def tiempos_por_habitacion(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        """RF-15, CP-19."""
        filtro = self._filtro(actor, desde, hasta, propiedad_id, empleado_id)
        return self._reportes.tiempos_por_habitacion(filtro, paginacion)

    def tiempos_por_empleado(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        filtro = self._filtro(actor, desde, hasta, propiedad_id, empleado_id)
        return self._reportes.tiempos_por_empleado(filtro, paginacion)

    def danos_por_propiedad(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        filtro = self._filtro(actor, desde, hasta, propiedad_id, None)
        return self._reportes.danos_por_propiedad(filtro, paginacion)

    def _filtro(
        self,
        actor: Usuario,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> FiltroReporte:
        if propiedad_id is not None:
            if self._propiedades.obtener(propiedad_id) is None:
                raise NoEncontrado
            exigir_propiedad_visible(actor, propiedad_id, self._propiedades)
        return FiltroReporte(
            visibles=propiedades_visibles(actor, self._propiedades),
            desde=desde,
            hasta=hasta,
            propiedad_id=propiedad_id,
            empleado_id=empleado_id,
        )
