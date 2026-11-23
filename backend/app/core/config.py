from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_ARCHIVO_ENV = ".env"
_LARGO_MIN_SECRETO = 32


class Settings(BaseSettings):
    """Configuración de la API. Usa el rol sin privilegios de PostgreSQL."""

    model_config = SettingsConfigDict(env_file=_ARCHIVO_ENV, extra="ignore")

    database_url: SecretStr
    jwt_secreto: SecretStr = Field(min_length=_LARGO_MIN_SECRETO)
    fotos_firma_secreto: SecretStr = Field(min_length=_LARGO_MIN_SECRETO)
    fotos_dir: Path
    entorno: Literal["desarrollo", "produccion"] = "desarrollo"
    cors_origenes: list[str] = []
    access_minutos: int = 15
    refresh_horas: int = 12
    foto_url_segundos: int = 300


class MigrationSettings(BaseSettings):
    """Configuración de Alembic y de la semilla. Usa el rol dueño; la API nunca la carga."""

    model_config = SettingsConfigDict(env_file=_ARCHIVO_ENV, extra="ignore")

    migration_database_url: SecretStr


class SemillaSettings(MigrationSettings):
    """Clave de los usuarios que crea `scripts/semilla.py`; solo para desarrollo."""

    semilla_clave: SecretStr


@lru_cache
def get_settings() -> Settings:
    return Settings()
