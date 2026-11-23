from datetime import UTC, datetime
from typing import Protocol


class Reloj(Protocol):
    def ahora(self) -> datetime: ...


class RelojSistema:
    """RNF-06: toda hora del dominio sale del servidor, en UTC."""

    def ahora(self) -> datetime:
        return datetime.now(UTC)
