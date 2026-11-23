from app.core.exceptions import ServicioNoDisponible
from app.repositories.salud import SaludRepository


class SaludService:
    def __init__(self, repositorio: SaludRepository) -> None:
        self._repositorio = repositorio

    def comprobar(self) -> None:
        if not self._repositorio.base_disponible():
            raise ServicioNoDisponible
