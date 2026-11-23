from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.utilidades import (
    Escenario,
    RelojFalso,
    archivo,
    asignar,
    completar,
    finalizar,
    foto_salida,
    iniciar,
    login,
)


def test_cp06_la_asignacion_aparece_en_la_lista_del_dia_por_prioridad(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    supervisor = login(cliente, "ANDINO", "supervisor")
    hoy = reloj.hoy_local().isoformat()
    for habitacion, prioridad in ((escenario.a.habitacion2_id, 2), (escenario.a.habitacion_id, 1)):
        creada = cliente.post(
            "/asignaciones",
            headers=supervisor,
            json={
                "habitacion_id": str(habitacion),
                "empleado_id": str(escenario.a.empleado_id),
                "fecha": hoy,
                "prioridad": prioridad,
            },
        )
        assert creada.status_code == 201

    tareas = cliente.get("/asignaciones/hoy", headers=login(cliente, "ANDINO", "empleado"))

    assert [t["habitacion_nombre"] for t in tareas.json()["items"]] == ["101", "102"]
    assert {t["estado_trabajo"] for t in tareas.json()["items"]} == {"pendiente"}


def test_no_se_asigna_en_fechas_pasadas(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    ayer = reloj.hoy_local() - timedelta(days=1)

    respuesta = cliente.post(
        "/asignaciones",
        headers=admin,
        json={
            "habitacion_id": str(escenario.a.habitacion_id),
            "empleado_id": str(escenario.a.empleado_id),
            "fecha": ayer.isoformat(),
        },
    )

    assert respuesta.status_code == 422


def test_cp07_la_primera_foto_arranca_el_cronometro_con_la_hora_del_servidor(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())

    iniciada = iniciar(cliente, login(cliente, "ANDINO", "empleado"), limpieza)

    assert iniciada["estado_trabajo"] == "en_curso"
    assert datetime.fromisoformat(iniciada["inicio"]) == reloj.ahora()


def test_cp08_sin_las_fotos_minimas_no_se_puede_terminar(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    cliente.patch(
        f"/habitaciones/{escenario.a.habitacion_id}",
        headers=admin,
        json={"fotos_min_entrada": 2},
    )
    limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)

    salida = cliente.post(
        f"/limpiezas/{limpieza}/fotos",
        headers=empleado,
        data={"momento": "salida"},
        files=archivo(),
    )
    sin_salida = cliente.post(f"/limpiezas/{limpieza}/finalizar", headers=empleado)

    assert salida.status_code == 409
    assert salida.json()["codigo"] == "fotos_entrada_insuficientes"
    assert sin_salida.status_code == 409


def test_cp11_duracion_neta_descuenta_las_pausas(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")

    iniciar(cliente, empleado, limpieza)
    reloj.avanzar(minutes=10)
    pausa = cliente.post(
        f"/limpiezas/{limpieza}/pausas", headers=empleado, json={"motivo": "descanso"}
    )
    reloj.avanzar(minutes=5)
    reanudada = cliente.post(f"/limpiezas/{limpieza}/reanudar", headers=empleado)
    reloj.avanzar(minutes=15)
    foto_salida(cliente, empleado, limpieza)
    terminada = finalizar(cliente, empleado, limpieza)

    assert pausa.status_code == 201 and reanudada.status_code == 200
    assert terminada["duracion_neta_seg"] == 1500
    assert terminada["estado_trabajo"] == "enviada"


def test_no_se_puede_terminar_con_una_pausa_abierta(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)
    cliente.post(f"/limpiezas/{limpieza}/pausas", headers=empleado, json={"motivo": "descanso"})

    respuesta = cliente.post(f"/limpiezas/{limpieza}/finalizar", headers=empleado)

    assert respuesta.status_code == 409
    assert respuesta.json()["codigo"] == "pausa_abierta"


def test_cp12_al_enviar_se_desbloquea_la_siguiente_sin_esperar_revision(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    primera = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    segunda = asignar(cliente, admin, escenario.a, reloj.hoy_local(), escenario.a.habitacion2_id)
    empleado = login(cliente, "ANDINO", "empleado")

    iniciar(cliente, empleado, primera)
    bloqueada = cliente.post(f"/limpiezas/{segunda}/iniciar", headers=empleado, files=archivo())
    enviada = completar_restante(cliente, empleado, primera, reloj)
    desbloqueada = cliente.post(f"/limpiezas/{segunda}/iniciar", headers=empleado, files=archivo())

    assert bloqueada.status_code == 409
    assert bloqueada.json()["codigo"] == "otra_limpieza_abierta"
    assert enviada["estado_trabajo"] == "enviada"
    assert enviada["estado_revision"] == "pendiente"
    assert desbloqueada.status_code == 200


def completar_restante(
    cliente: TestClient, empleado: dict[str, str], limpieza: str, reloj: RelojFalso
) -> dict[str, object]:
    reloj.avanzar(minutes=20)
    foto_salida(cliente, empleado, limpieza)
    resultado: dict[str, object] = finalizar(cliente, empleado, limpieza)
    return resultado


def test_cp13_el_servidor_ignora_tiempos_enviados_por_el_cliente(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)
    reloj.avanzar(minutes=30)
    foto_salida(cliente, empleado, limpieza)

    pausa_con_hora = cliente.post(
        f"/limpiezas/{limpieza}/pausas",
        headers=empleado,
        json={"motivo": "descanso", "inicio": "2020-01-01T00:00:00Z"},
    )
    terminada = cliente.post(
        f"/limpiezas/{limpieza}/finalizar",
        headers=empleado,
        json={"duracion_neta_seg": 1, "fin": "2020-01-01T00:00:00Z"},
    )

    assert pausa_con_hora.status_code == 422
    assert terminada.status_code == 200
    assert terminada.json()["duracion_neta_seg"] == 1800


def test_rnf03_reintentos_con_el_mismo_id_no_duplican_fotos(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso, sql_owner: Session
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    foto_id = "6f1c1c1e-0000-4000-8000-000000000001"

    for _ in range(2):
        respuesta = cliente.post(
            f"/limpiezas/{limpieza}/iniciar",
            headers=empleado,
            data={"foto_id": foto_id},
            files=archivo(),
        )
        assert respuesta.status_code == 200

    total = sql_owner.scalar(
        text("SELECT count(*) FROM foto WHERE limpieza_id = :l"), {"l": limpieza}
    )
    assert total == 1


def test_un_empleado_no_toca_la_limpieza_de_otro(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    otro = login(cliente, "ANDINO", "empleado2")

    assert (
        cliente.post(f"/limpiezas/{limpieza}/iniciar", headers=otro, files=archivo()).status_code
        == 404
    )
    assert cliente.get(f"/limpiezas/{limpieza}", headers=otro).status_code == 404


def test_rechaza_archivos_que_no_son_fotos(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    falso = {"archivo": ("foto.jpg", b"<script>alert(1)</script>", "image/jpeg")}

    respuesta = cliente.post(
        f"/limpiezas/{limpieza}/iniciar", headers=login(cliente, "ANDINO", "empleado"), files=falso
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["codigo"] == "foto_invalida"


def test_foto_servida_con_url_firmada_sin_exif(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    completar(cliente, login(cliente, "ANDINO", "empleado"), limpieza, reloj)

    detalle = cliente.get(f"/limpiezas/{limpieza}", headers=admin).json()
    url = detalle["fotos"][0]["url"]
    descarga = cliente.get(url)
    alterada = cliente.get(url[:-1] + ("1" if url.endswith("0") else "0"))

    assert url.startswith("/fotos/archivo?")
    assert descarga.status_code == 200
    assert descarga.headers["content-type"] == "image/jpeg"
    assert b"Exif" not in descarga.content[:200]
    assert alterada.status_code == 404
