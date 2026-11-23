import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from pydantic import SecretStr

from app.core.almacen_fotos import AlmacenLocal
from app.core.exceptions import NoAutenticado
from app.core.seguridad import (
    EmisorTokens,
    empresa_de_refresh,
    generar_hash_clave,
    generar_refresh,
    verificar_clave,
)

_SECRETO = SecretStr("s" * 32)
_AHORA = datetime(2026, 11, 20, 12, tzinfo=UTC)


def test_la_clave_se_guarda_con_argon2id_y_nunca_en_texto_plano() -> None:
    hash_clave = generar_hash_clave("clave-segura")

    assert hash_clave.startswith("$argon2id$")
    assert "clave-segura" not in hash_clave
    assert verificar_clave(hash_clave, "clave-segura")
    assert not verificar_clave(hash_clave, "otra")


def test_access_token_lleva_usuario_y_empresa_y_dura_15_minutos() -> None:
    emisor = EmisorTokens(_SECRETO, 15)
    usuario, empresa = uuid.uuid4(), uuid.uuid4()

    token = emisor.crear_access(usuario, empresa, datetime.now(UTC))
    datos = emisor.leer_access(token)

    assert (datos.usuario_id, datos.empresa_id) == (usuario, empresa)
    assert emisor.segundos_vigencia == 900


def test_rechaza_token_vencido() -> None:
    emisor = EmisorTokens(_SECRETO, 15)
    token = emisor.crear_access(uuid.uuid4(), uuid.uuid4(), _AHORA - timedelta(hours=1))

    with pytest.raises(NoAutenticado):
        emisor.leer_access(token)


def test_rechaza_token_firmado_con_otro_secreto_o_sin_firma() -> None:
    emisor = EmisorTokens(_SECRETO, 15)
    datos = {"sub": str(uuid.uuid4()), "empresa_id": str(uuid.uuid4()), "exp": 9999999999}
    falsificado = jwt.encode(datos, "o" * 32, algorithm="HS256")
    sin_firma = jwt.encode(datos, key=None, algorithm="none")

    for token in (falsificado, sin_firma):
        with pytest.raises(NoAutenticado):
            emisor.leer_access(token)


def test_el_refresh_lleva_la_empresa_y_es_aleatorio() -> None:
    empresa = uuid.uuid4()

    assert empresa_de_refresh(generar_refresh(empresa)) == empresa
    assert generar_refresh(empresa) != generar_refresh(empresa)
    with pytest.raises(NoAutenticado):
        empresa_de_refresh("basura.token")


def test_url_firmada_de_foto_vence_y_no_admite_firmas_alteradas(tmp_path: Path) -> None:
    almacen = AlmacenLocal(tmp_path, _SECRETO, 300)
    almacen.guardar("e/p/l/foto.jpg", b"jpeg")
    url = almacen.url_firmada("e/p/l/foto.jpg", _AHORA)
    expira = int(url.split("expira=")[1].split("&")[0])
    firma = url.split("firma=")[1]

    assert almacen.ruta_si_firma_valida("e/p/l/foto.jpg", expira, firma, _AHORA) is not None
    assert almacen.ruta_si_firma_valida("e/p/l/foto.jpg", expira, "0" * 64, _AHORA) is None
    despues = _AHORA + timedelta(seconds=301)
    assert almacen.ruta_si_firma_valida("e/p/l/foto.jpg", expira, firma, despues) is None


def test_almacen_bloquea_rutas_fuera_de_su_carpeta(tmp_path: Path) -> None:
    almacen = AlmacenLocal(tmp_path / "fotos", _SECRETO, 300)

    with pytest.raises(ValueError, match="fuera del almac"):
        almacen.guardar("../../escape.txt", b"x")
