import hashlib
import hmac
from datetime import datetime, timedelta
from pathlib import Path
from typing import Protocol
from urllib.parse import urlencode

from pydantic import SecretStr


class AlmacenFotos(Protocol):
    """Implementación local en desarrollo; S3 o compatible en el despliegue."""

    def guardar(self, clave: str, contenido: bytes) -> None: ...

    def eliminar(self, clave: str) -> None: ...

    def url_firmada(self, clave: str, ahora: datetime) -> str: ...


class AlmacenLocal:
    def __init__(self, directorio: Path, secreto: SecretStr, segundos_url: int) -> None:
        self._directorio = directorio.resolve()
        self._secreto = secreto.get_secret_value().encode()
        self._vigencia = timedelta(seconds=segundos_url)

    def guardar(self, clave: str, contenido: bytes) -> None:
        ruta = self._ruta(clave)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(contenido)

    def eliminar(self, clave: str) -> None:
        self._ruta(clave).unlink(missing_ok=True)

    def url_firmada(self, clave: str, ahora: datetime) -> str:
        expira = int((ahora + self._vigencia).timestamp())
        consulta = urlencode(
            {"clave": clave, "expira": expira, "firma": self._firmar(clave, expira)}
        )
        return f"/fotos/archivo?{consulta}"

    def ruta_si_firma_valida(
        self, clave: str, expira: int, firma: str, ahora: datetime
    ) -> Path | None:
        if expira < ahora.timestamp():
            return None
        if not hmac.compare_digest(self._firmar(clave, expira), firma):
            return None
        ruta = self._ruta(clave)
        return ruta if ruta.is_file() else None

    def _firmar(self, clave: str, expira: int) -> str:
        return hmac.new(self._secreto, f"{clave}|{expira}".encode(), hashlib.sha256).hexdigest()

    def _ruta(self, clave: str) -> Path:
        ruta = (self._directorio / clave).resolve()
        if not ruta.is_relative_to(self._directorio):
            raise ValueError("Clave de foto fuera del almacén")
        return ruta
