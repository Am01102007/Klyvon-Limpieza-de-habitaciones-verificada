"""Pruebas de integración: API real (TestClient) contra PostgreSQL real con RLS.

Necesitan la base desechable de `docker-compose.test.yml` y las variables `TEST_DATABASE_URL`
(rol limpieza_app) y `TEST_MIGRATION_DATABASE_URL` (rol limpieza_owner), en el entorno o en `.env`.
Sin ellas se omiten; en CI siempre están definidas.
"""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Literal

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from app.api.limites import limitador
from app.core.config import Settings
from app.core.seguridad import generar_hash_clave
from app.main import create_app
from app.models import CLASE_POR_ROL, Empresa, Habitacion, Propiedad, SupervisorPropiedad
from app.models.enums import Idioma, Rol, TipoClave, TipoPropiedad
from tests.integration.utilidades import CLAVE, ZONA, DatosEmpresa, Escenario, RelojFalso

_TABLAS = (
    "foto, dano_historial, dano, revision, pausa, limpieza, asignacion, habitacion, "
    "supervisor_propiedad, propiedad, refresh_token, usuario, empresa"
)


class AjustesPrueba(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    test_database_url: SecretStr | None = None
    test_migration_database_url: SecretStr | None = None


_AJUSTES = AjustesPrueba()


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if _AJUSTES.test_database_url and _AJUSTES.test_migration_database_url:
        return
    omitir = pytest.mark.skip(reason="Falta TEST_DATABASE_URL / TEST_MIGRATION_DATABASE_URL")
    for item in items:
        if "integration" in item.path.parts:
            item.add_marker(omitir)


@pytest.fixture(scope="session")
def motor_owner() -> Iterator[Engine]:
    assert _AJUSTES.test_migration_database_url is not None
    url = _AJUSTES.test_migration_database_url.get_secret_value()
    configuracion = Config("alembic.ini")
    configuracion.attributes["url"] = url
    configuracion.attributes["configurar_logs"] = False
    command.downgrade(configuracion, "base")
    command.upgrade(configuracion, "head")
    motor = create_engine(url, connect_args={"options": "-c timezone=UTC"})
    yield motor
    motor.dispose()


@pytest.fixture(scope="session")
def motor_app() -> Iterator[Engine]:
    """Conexión con el rol de la API, para comprobar RLS sin pasar por la aplicación."""
    assert _AJUSTES.test_database_url is not None
    motor = create_engine(_AJUSTES.test_database_url.get_secret_value())
    yield motor
    motor.dispose()


@pytest.fixture(scope="session")
def reloj() -> RelojFalso:
    return RelojFalso()


def _ajustes(
    fotos: pytest.TempPathFactory, entorno: Literal["desarrollo", "produccion"]
) -> Settings:
    assert _AJUSTES.test_database_url is not None
    return Settings(
        _env_file=None,
        database_url=_AJUSTES.test_database_url,
        jwt_secreto=SecretStr("j" * 40),
        fotos_firma_secreto=SecretStr("f" * 40),
        fotos_dir=fotos.mktemp("fotos"),
        cors_origenes=["https://app.ejemplo.test"],
        entorno=entorno,
    )


@pytest.fixture(scope="session")
def ajustes(tmp_path_factory: pytest.TempPathFactory) -> Settings:
    return _ajustes(tmp_path_factory, "desarrollo")


@pytest.fixture(scope="session")
def app(ajustes: Settings, reloj: RelojFalso) -> FastAPI:
    aplicacion = create_app(ajustes)
    aplicacion.state.reloj = reloj
    return aplicacion


@pytest.fixture(scope="session")
def app_produccion(tmp_path_factory: pytest.TempPathFactory) -> FastAPI:
    return create_app(_ajustes(tmp_path_factory, "produccion"))


@pytest.fixture
def cliente(app: FastAPI, escenario: Escenario) -> TestClient:
    # https: la cookie de refresh es Secure y el cliente no la enviaría por http.
    # Sin `with`: no arranca el programador de tareas en cada prueba.
    return TestClient(app, base_url="https://testserver")


@pytest.fixture(autouse=True)
def _estado_limpio(reloj: RelojFalso) -> None:
    limitador.reset()
    reloj.momento = datetime.now(UTC)


def _crear_empresa(sesion: Session, codigo: str, hash_clave: str) -> DatosEmpresa:
    empresa = Empresa(nombre=f"Empresa {codigo}", codigo=codigo)
    sesion.add(empresa)
    sesion.flush()
    veterano = datetime.now(UTC) - timedelta(days=90)

    def usuario(nombre: str, rol: Rol) -> uuid.UUID:
        nuevo = CLASE_POR_ROL[rol](
            empresa_id=empresa.id,
            nombre_usuario=nombre,
            hash_clave=hash_clave,
            tipo_clave=TipoClave.CONTRASENA,
            idioma=Idioma.ES,
            creado_en=veterano,
        )
        sesion.add(nuevo)
        sesion.flush()
        return nuevo.id

    ids = {
        nombre: usuario(nombre, rol)
        for nombre, rol in (
            ("admin", Rol.ADMIN),
            ("supervisor", Rol.SUPERVISOR),
            ("empleado", Rol.EMPLEADO),
            ("empleado2", Rol.EMPLEADO),
        )
    }
    propiedad = Propiedad(
        empresa_id=empresa.id, nombre="Hotel Centro", tipo=TipoPropiedad.HOTEL, zona_horaria=ZONA
    )
    sesion.add(propiedad)
    sesion.flush()
    habitaciones = [
        Habitacion(empresa_id=empresa.id, propiedad_id=propiedad.id, nombre=nombre)
        for nombre in ("101", "102")
    ]
    sesion.add_all(habitaciones)
    sesion.add(
        SupervisorPropiedad(
            empresa_id=empresa.id, usuario_id=ids["supervisor"], propiedad_id=propiedad.id
        )
    )
    sesion.flush()
    return DatosEmpresa(
        id=empresa.id,
        codigo=codigo,
        admin_id=ids["admin"],
        supervisor_id=ids["supervisor"],
        empleado_id=ids["empleado"],
        empleado2_id=ids["empleado2"],
        propiedad_id=propiedad.id,
        habitacion_id=habitaciones[0].id,
        habitacion2_id=habitaciones[1].id,
    )


@pytest.fixture(scope="session")
def hash_clave() -> str:
    return generar_hash_clave(CLAVE)


@pytest.fixture
def escenario(motor_owner: Engine, hash_clave: str) -> Escenario:
    """Dos empresas con la misma estructura, para probar el aislamiento (RNF-08)."""
    with Session(motor_owner) as sesion:
        sesion.execute(text(f"TRUNCATE {_TABLAS} CASCADE"))
        datos = Escenario(
            a=_crear_empresa(sesion, "ANDINO", hash_clave),
            b=_crear_empresa(sesion, "SUR", hash_clave),
        )
        sesion.commit()
    return datos


@pytest.fixture
def sql_owner(motor_owner: Engine) -> Iterator[Session]:
    """Para preparar datos que la API no deja crear (por ejemplo, fotos de hace 31 días)."""
    with Session(motor_owner) as sesion:
        yield sesion
