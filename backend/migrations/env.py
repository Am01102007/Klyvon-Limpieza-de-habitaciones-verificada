from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import MigrationSettings
from app.models.base import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configurar_logs", True):
    fileConfig(config.config_file_name)


def _url() -> str:
    url = config.attributes.get("url")
    if url is not None:
        return str(url)
    ajustes = MigrationSettings()
    return ajustes.migration_database_url.get_secret_value()


def ejecutar_migraciones() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as conexion:
        context.configure(connection=conexion, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Solo se admiten migraciones en línea")
ejecutar_migraciones()
