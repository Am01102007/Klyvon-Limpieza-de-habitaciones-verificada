import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.models.enums import ReglaRevision

_ANTIGUEDAD_EMPLEADO_NUEVO = timedelta(weeks=2)
_FACTOR_LIMPIEZA_RAPIDA = 0.6


@dataclass(frozen=True)
class DatosRevision:
    empleado_creado_en: datetime
    ahora: datetime
    tiene_danos: bool
    duracion_neta_seg: int
    promedio_habitacion_seg: float | None


class EstrategiaRevision(Protocol):
    def requiere_revision(self, datos: DatosRevision) -> bool: ...


class RevisarTodo:
    def requiere_revision(self, datos: DatosRevision) -> bool:
        return True


class RevisarMuestra:
    def __init__(self, n: int, azar: random.Random) -> None:
        self._n = n
        self._azar = azar

    def requiere_revision(self, datos: DatosRevision) -> bool:
        return self._azar.random() < 1 / self._n


class RevisarRiesgo:
    def requiere_revision(self, datos: DatosRevision) -> bool:
        return (
            datos.ahora - datos.empleado_creado_en < _ANTIGUEDAD_EMPLEADO_NUEVO
            or datos.tiene_danos
            or (
                datos.promedio_habitacion_seg is not None
                and datos.duracion_neta_seg
                < datos.promedio_habitacion_seg * _FACTOR_LIMPIEZA_RAPIDA
            )
        )


def crear_estrategia(
    regla: ReglaRevision, muestra_n: int, azar: random.Random
) -> EstrategiaRevision:
    """RF-11, CP-14 a CP-16."""
    estrategias: dict[ReglaRevision, EstrategiaRevision] = {
        ReglaRevision.TODO: RevisarTodo(),
        ReglaRevision.MUESTRA: RevisarMuestra(muestra_n, azar),
        ReglaRevision.RIESGO: RevisarRiesgo(),
    }
    return estrategias[regla]
