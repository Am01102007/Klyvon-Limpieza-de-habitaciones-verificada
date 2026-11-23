from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Paginacion:
    limite: int = 50
    desplazamiento: int = 0


@dataclass(frozen=True)
class Pagina[T]:
    items: Sequence[T]
    total: int
    limite: int
    desplazamiento: int
