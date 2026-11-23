import uuid

from pydantic import SecretStr
from sqlalchemy import Connection, Engine, create_engine, event, text
from sqlalchemy.orm import Session, SessionTransaction, sessionmaker

_SEGUNDOS_MAX_CONEXION = 5
CLAVE_EMPRESA = "empresa_id"


def crear_engine(url: SecretStr) -> Engine:
    return create_engine(
        url.get_secret_value(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": _SEGUNDOS_MAX_CONEXION, "options": "-c timezone=UTC"},
    )


def crear_fabrica_sesiones(engine: Engine) -> sessionmaker[Session]:
    fabrica = sessionmaker(engine, expire_on_commit=False)
    event.listen(fabrica, "after_begin", _fijar_empresa_en_transaccion)
    return fabrica


def _fijar_empresa_en_transaccion(
    sesion: Session, _: SessionTransaction, conexion: Connection
) -> None:
    """RNF-08: las políticas RLS leen este valor; sin él, ninguna fila es visible."""
    empresa_id = sesion.info.get(CLAVE_EMPRESA)
    if empresa_id is not None:
        conexion.execute(
            text("SELECT set_config('app.empresa_id', :empresa_id, true)"),
            {"empresa_id": str(empresa_id)},
        )


class Transaccion:
    """Marca los límites de cada caso de uso: todo se confirma junto o nada."""

    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def fijar_empresa(self, empresa_id: uuid.UUID) -> None:
        self._sesion.rollback()
        self._sesion.info[CLAVE_EMPRESA] = empresa_id

    def confirmar(self) -> None:
        self._sesion.commit()
