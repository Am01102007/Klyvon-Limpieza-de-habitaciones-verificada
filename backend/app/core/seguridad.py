import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from pydantic import SecretStr

from app.core.exceptions import NoAutenticado

_ALGORITMO = "HS256"
_argon2 = PasswordHasher()
_HASH_SIMULADO = _argon2.hash(secrets.token_urlsafe(16))


def generar_hash_clave(clave: str) -> str:
    return _argon2.hash(clave)


def verificar_clave(hash_clave: str, clave: str) -> bool:
    try:
        return _argon2.verify(hash_clave, clave)
    except VerificationError, InvalidHashError:
        return False


def simular_verificacion(clave: str) -> None:
    """Iguala el tiempo de respuesta cuando el usuario no existe."""
    verificar_clave(_HASH_SIMULADO, clave)


@dataclass(frozen=True)
class DatosAccessToken:
    usuario_id: uuid.UUID
    empresa_id: uuid.UUID


class EmisorTokens:
    def __init__(self, secreto: SecretStr, minutos: int) -> None:
        self._secreto = secreto.get_secret_value()
        self._vigencia = timedelta(minutes=minutos)

    def crear_access(self, usuario_id: uuid.UUID, empresa_id: uuid.UUID, ahora: datetime) -> str:
        return jwt.encode(
            {
                "sub": str(usuario_id),
                "empresa_id": str(empresa_id),
                "iat": ahora,
                "exp": ahora + self._vigencia,
            },
            self._secreto,
            algorithm=_ALGORITMO,
        )

    def leer_access(self, token: str) -> DatosAccessToken:
        try:
            datos = jwt.decode(
                token,
                self._secreto,
                algorithms=[_ALGORITMO],
                options={"require": ["sub", "exp", "empresa_id"]},
            )
            return DatosAccessToken(uuid.UUID(datos["sub"]), uuid.UUID(datos["empresa_id"]))
        except (jwt.InvalidTokenError, ValueError) as error:
            raise NoAutenticado from error

    @property
    def segundos_vigencia(self) -> int:
        return int(self._vigencia.total_seconds())


def generar_refresh(empresa_id: uuid.UUID) -> str:
    """Incluye la empresa para poder fijar RLS antes de buscar el token."""
    return f"{empresa_id}.{secrets.token_urlsafe(32)}"


def empresa_de_refresh(token: str) -> uuid.UUID:
    try:
        return uuid.UUID(token.split(".", 1)[0])
    except ValueError as error:
        raise NoAutenticado from error


def hash_refresh(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
