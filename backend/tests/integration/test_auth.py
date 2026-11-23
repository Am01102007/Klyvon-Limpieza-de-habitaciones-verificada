from fastapi.testclient import TestClient

from tests.integration.utilidades import CLAVE, Escenario, RelojFalso, login


def _login(cliente: TestClient, codigo: str, usuario: str, clave: str) -> int:
    datos = {"codigo_empresa": codigo, "nombre_usuario": usuario, "clave": clave}
    return int(cliente.post("/auth/login", json=datos).status_code)


def test_cp01_login_correcto_entrega_token_y_cookie_segura(cliente: TestClient) -> None:
    respuesta = cliente.post(
        "/auth/login",
        json={"codigo_empresa": "andino", "nombre_usuario": "empleado", "clave": CLAVE},
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["usuario"]["rol"] == "empleado"
    assert cuerpo["expira_en_seg"] == 900
    assert "hash_clave" not in respuesta.text
    cookie = respuesta.headers["set-cookie"].lower()
    for atributo in ("httponly", "secure", "samesite=strict", "path=/auth"):
        assert atributo in cookie
    perfil = cliente.get("/auth/yo", headers={"Authorization": f"Bearer {cuerpo['access_token']}"})
    assert perfil.json()["nombre_usuario"] == "empleado"


def test_cp02_cinco_fallos_bloquean_15_minutos_aunque_la_clave_sea_correcta(
    cliente: TestClient, reloj: RelojFalso
) -> None:
    for _ in range(5):
        assert _login(cliente, "ANDINO", "empleado", "incorrecta") == 401

    assert _login(cliente, "ANDINO", "empleado", CLAVE) == 423
    reloj.avanzar(minutes=14)
    assert _login(cliente, "ANDINO", "empleado", CLAVE) == 423
    reloj.avanzar(minutes=2)
    assert _login(cliente, "ANDINO", "empleado", CLAVE) == 200


def test_credenciales_invalidas_no_revelan_si_existe_la_empresa_o_el_usuario(
    cliente: TestClient,
) -> None:
    respuestas = [
        cliente.post(
            "/auth/login",
            json={"codigo_empresa": codigo, "nombre_usuario": usuario, "clave": "x" * 8},
        )
        for codigo, usuario in (("NOEXISTE", "admin"), ("ANDINO", "nadie"), ("ANDINO", "admin"))
    ]

    assert {r.status_code for r in respuestas} == {401}
    assert {r.json()["codigo"] for r in respuestas} == {"credenciales_invalidas"}


def _refresh(cliente: TestClient, token: str) -> int:
    cliente.cookies.clear()
    respuesta = cliente.post("/auth/refresh", headers={"Cookie": f"refresh_token={token}"})
    return int(respuesta.status_code)


def test_refresh_rota_el_token_y_reusar_uno_viejo_cierra_la_sesion(cliente: TestClient) -> None:
    login(cliente, "ANDINO", "admin")
    viejo = cliente.cookies.get("refresh_token")
    assert viejo is not None

    assert cliente.post("/auth/refresh").status_code == 200
    nuevo = cliente.cookies.get("refresh_token")
    assert nuevo is not None and nuevo != viejo

    assert _refresh(cliente, viejo) == 401
    # Reusar un token ya rotado revoca toda la sesión: el nuevo tampoco sirve.
    assert _refresh(cliente, nuevo) == 401


def test_logout_revoca_el_refresh(cliente: TestClient) -> None:
    login(cliente, "ANDINO", "admin")
    token = cliente.cookies.get("refresh_token")
    assert token is not None

    assert cliente.post("/auth/logout").status_code == 204
    assert _refresh(cliente, token) == 401


def test_sin_token_o_con_token_falso_responde_401(cliente: TestClient) -> None:
    assert cliente.get("/auth/yo").status_code == 401
    falso = {"Authorization": "Bearer eyJhbGciOiJub25lIn0.e30."}
    assert cliente.get("/auth/yo", headers=falso).status_code == 401


def test_usuario_desactivado_no_puede_usar_su_token(
    cliente: TestClient, escenario: Escenario
) -> None:
    empleado = login(cliente, "ANDINO", "empleado")
    admin = login(cliente, "ANDINO", "admin")

    cambio = cliente.patch(
        f"/usuarios/{escenario.a.empleado_id}", headers=admin, json={"activo": False}
    )

    assert cambio.status_code == 200
    assert cliente.get("/auth/yo", headers=empleado).status_code == 401
    assert _login(cliente, "ANDINO", "empleado", CLAVE) == 401
