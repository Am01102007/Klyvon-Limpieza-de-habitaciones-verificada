from datetime import timedelta

from app.core.almacen_fotos import AlmacenFotos
from app.core.database import Transaccion
from app.core.reloj import Reloj
from app.models import Empresa
from app.repositories.danos import FotoVencidaRepository

_LOTE = 500


class BorradoFotosService:
    def __init__(
        self,
        tx: Transaccion,
        fotos: FotoVencidaRepository,
        almacen: AlmacenFotos,
        reloj: Reloj,
    ) -> None:
        self._tx = tx
        self._fotos = fotos
        self._almacen = almacen
        self._reloj = reloj

    def borrar_vencidas(self, empresa: Empresa) -> int:
        """CU-15, CP-20. Se confirma por lotes para no dejar archivos sin fila."""
        antes_de = self._reloj.ahora() - timedelta(days=empresa.retencion_fotos_dias)
        borradas = 0
        while lote := self._fotos.vencidas(antes_de, _LOTE):
            claves = [foto.url for foto in lote]
            for foto in lote:
                self._fotos.eliminar(foto)
            self._tx.confirmar()
            for clave in claves:
                self._almacen.eliminar(clave)
            borradas += len(lote)
        return borradas
