from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings

_SECRETO = SecretStr("x" * 32)


def test_la_url_de_la_base_no_aparece_al_imprimir_la_configuracion() -> None:
    clave = "clave-que-no-debe-filtrarse"
    ajustes = Settings(
        _env_file=None,
        database_url=SecretStr(f"postgresql+psycopg://u:{clave}@h/db"),
        jwt_secreto=_SECRETO,
        fotos_firma_secreto=_SECRETO,
        fotos_dir=Path("fotos"),
    )

    assert clave not in repr(ajustes)
    assert clave not in str(ajustes)


def test_falla_si_falta_la_url_de_la_base(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_rechaza_secretos_cortos() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url=SecretStr("postgresql+psycopg://u:p@h/db"),
            jwt_secreto=SecretStr("corto"),
            fotos_firma_secreto=_SECRETO,
            fotos_dir=Path("fotos"),
        )
