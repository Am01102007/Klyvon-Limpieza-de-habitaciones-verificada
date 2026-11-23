"""Seguridad de la API: ISO/IEC 25010 (confidencialidad, integridad) y OWASP API Top 10."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.imagenes import MAX_BYTES_SUBIDA
from tests.integration.utilidades import CLAVE, Escenario, login


def test_cabeceras_de_seguridad_en_cada_respuesta(cliente: TestClient) -> None:
    respuesta = cliente.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.headers["x-content-type-options"] == "nosniff"
    assert respuesta.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in respuesta.headers["content-security-policy"]


def test_en_produccion_activa_hsts_y_oculta_la_documentacion(
    app_produccion: FastAPI, escenario: Escenario
) -> None:
    cliente = TestClient(app_produccion, base_url="https://testserver")

    assert "max-age=31536000" in cliente.get("/health").headers["strict-transport-security"]
    assert cliente.get("/docs").status_code == 404
    assert cliente.get("/openapi.json").status_code == 404


def test_cors_solo_para_origenes_de_la_lista(cliente: TestClient) -> None:
    permitido = cliente.options(
        "/auth/login",
        headers={"Origin": "https://app.ejemplo.test", "Access-Control-Request-Method": "POST"},
    )
    ajeno = cliente.options(
        "/auth/login",
        headers={"Origin": "https://atacante.test", "Access-Control-Request-Method": "POST"},
    )

    assert permitido.headers["access-control-allow-origin"] == "https://app.ejemplo.test"
    assert "access-control-allow-origin" not in ajeno.headers


def test_rate_limiting_en_login(cliente: TestClient) -> None:
    datos = {"codigo_empresa": "NOEXISTE", "nombre_usuario": "x", "clave": "x"}

    estados = [cliente.post("/auth/login", json=datos).status_code for _ in range(21)]

    assert estados[:20] == [401] * 20
    assert estados[20] == 429


def test_validacion_estricta_y_errores_sin_eco_de_datos(cliente: TestClient) -> None:
    secreto = "MiClaveSecreta123"
    respuestas = [
        cliente.post("/auth/login", json={"codigo_empresa": "A", "clave": secreto}),
        cliente.post(
            "/auth/login",
            json={"codigo_empresa": "A", "nombre_usuario": "x", "clave": secreto, "rol": "admin"},
        ),
        cliente.post(
            "/auth/login",
            json={"codigo_empresa": "A" * 21, "nombre_usuario": "x", "clave": secreto},
        ),
    ]

    for respuesta in respuestas:
        assert respuesta.status_code == 422
        assert respuesta.json()["codigo"] == "entrada_invalida"
        assert secreto not in respuesta.text


def test_inyeccion_sql_en_el_login_no_entra(cliente: TestClient) -> None:
    for intento in ("' OR '1'='1", "admin'--", "ANDINO'; DROP TABLE usuario;--"):
        respuesta = cliente.post(
            "/auth/login",
            json={"codigo_empresa": "ANDINO", "nombre_usuario": intento, "clave": intento},
        )
        assert respuesta.status_code == 401

    assert login(cliente, "ANDINO", "admin", CLAVE)


def test_uuid_invalido_y_paginacion_fuera_de_rango_se_rechazan(cliente: TestClient) -> None:
    admin = login(cliente, "ANDINO", "admin")

    assert cliente.get("/limpiezas/1%20OR%201=1", headers=admin).status_code == 422
    assert cliente.get("/usuarios", headers=admin, params={"limite": 1000}).status_code == 422
    assert cliente.get("/usuarios", headers=admin, params={"desplazamiento": -1}).status_code == 422


def test_subidas_enormes_se_cortan_antes_de_leerlas(cliente: TestClient) -> None:
    respuesta = cliente.post(
        "/limpiezas/00000000-0000-0000-0000-000000000000/iniciar",
        headers={
            "Content-Length": str(MAX_BYTES_SUBIDA * 3),
            "Content-Type": "multipart/form-data",
        },
        content=b"",
    )

    assert respuesta.status_code == 413


def test_la_salida_de_usuarios_nunca_incluye_el_hash(cliente: TestClient) -> None:
    respuesta = cliente.get("/usuarios", headers=login(cliente, "ANDINO", "admin"))

    assert respuesta.status_code == 200
    assert "hash_clave" not in respuesta.text
    assert "argon2" not in respuesta.text


def test_rutas_desconocidas_responden_error_generico(cliente: TestClient) -> None:
    respuesta = cliente.get("/no-existe")

    assert respuesta.status_code == 404
    assert respuesta.json() == {"codigo": "no_encontrado"}
