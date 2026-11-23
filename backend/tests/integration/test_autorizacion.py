from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.integration.utilidades import Escenario, RelojFalso, asignar, login


def test_cp04_recurso_de_otra_empresa_responde_404_sin_datos(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    gestor_b = login(cliente, "SUR", "admin")
    limpieza_b = asignar(cliente, gestor_b, escenario.b, reloj.hoy_local())
    admin_a = login(cliente, "ANDINO", "admin")

    for ruta in (
        f"/limpiezas/{limpieza_b}",
        f"/usuarios/{escenario.b.empleado_id}",
        f"/propiedades/{escenario.b.propiedad_id}",
    ):
        respuesta = cliente.get(ruta, headers=admin_a)
        assert respuesta.status_code == 404, ruta
        assert respuesta.json() == {"codigo": "no_encontrado"}


def test_cp04_no_se_puede_asignar_una_habitacion_de_otra_empresa(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin_a = login(cliente, "ANDINO", "admin")

    respuesta = cliente.post(
        "/asignaciones",
        headers=admin_a,
        json={
            "habitacion_id": str(escenario.b.habitacion_id),
            "empleado_id": str(escenario.a.empleado_id),
            "fecha": reloj.hoy_local().isoformat(),
        },
    )

    assert respuesta.status_code == 404


def test_cp05_empleado_no_ve_reportes_ni_crea_usuarios(cliente: TestClient) -> None:
    empleado = login(cliente, "ANDINO", "empleado")

    assert cliente.get("/reportes/tiempos/habitaciones", headers=empleado).status_code == 403
    nuevo = {"nombre_usuario": "intruso", "rol": "admin", "clave": "123456"}
    assert cliente.post("/usuarios", headers=empleado, json=nuevo).status_code == 403
    assert cliente.get("/empresa", headers=empleado).status_code == 403


def test_supervisor_no_configura_la_empresa_ni_crea_usuarios(cliente: TestClient) -> None:
    supervisor = login(cliente, "ANDINO", "supervisor")

    assert cliente.patch("/empresa", headers=supervisor, json={"muestra_n": 2}).status_code == 403
    nuevo = {"nombre_usuario": "otro", "rol": "empleado", "clave": "123456"}
    assert cliente.post("/usuarios", headers=supervisor, json=nuevo).status_code == 403


def test_cp03_nombre_unico_por_empresa(cliente: TestClient) -> None:
    nuevo = {"nombre_usuario": "maria", "rol": "empleado", "clave": "1234", "tipo_clave": "pin"}
    admin_a = login(cliente, "ANDINO", "admin")
    admin_b = login(cliente, "SUR", "admin")

    assert cliente.post("/usuarios", headers=admin_a, json=nuevo).status_code == 201
    assert cliente.post("/usuarios", headers=admin_a, json=nuevo).status_code == 409
    assert cliente.post("/usuarios", headers=admin_b, json=nuevo).status_code == 201


def test_la_empresa_nunca_sale_del_cliente(cliente: TestClient, escenario: Escenario) -> None:
    admin_a = login(cliente, "ANDINO", "admin")
    intento = {
        "nombre_usuario": "colado",
        "rol": "empleado",
        "clave": "123456",
        "empresa_id": str(escenario.b.id),
    }

    respuesta = cliente.post("/usuarios", headers=admin_a, json=intento)

    assert respuesta.status_code == 422


def test_rls_sin_empresa_fijada_no_muestra_ninguna_fila(
    escenario: Escenario, motor_app: Engine
) -> None:
    """Segunda barrera (RNF-08): aunque falle la aplicación, la base no entrega filas."""
    with motor_app.connect() as conexion:
        assert conexion.scalar(text("SELECT count(*) FROM usuario")) == 0
        conexion.execute(
            text("SELECT set_config('app.empresa_id', :e, true)"), {"e": str(escenario.a.id)}
        )
        empresas = conexion.scalars(text("SELECT DISTINCT empresa_id FROM usuario")).all()

    assert empresas == [escenario.a.id]


def test_rol_de_la_api_no_puede_crear_empresas_ni_borrar_historial(
    escenario: Escenario, motor_app: Engine
) -> None:
    with motor_app.connect() as conexion:
        for sentencia in (
            "INSERT INTO empresa (id, nombre, codigo) VALUES (gen_random_uuid(), 'X', 'X')",
            "DELETE FROM dano_historial",
        ):
            try:
                conexion.execute(text(sentencia))
            except Exception as error:
                assert "permission denied" in str(error).lower()
                conexion.rollback()
            else:
                raise AssertionError(f"Se permitió: {sentencia}")
