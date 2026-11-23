import uuid
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.almacen_fotos import AlmacenFotos
from app.tareas import borrar_fotos_vencidas
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


def test_cp14_regla_todo_deja_cada_limpieza_en_la_cola_del_supervisor(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    supervisor = login(cliente, "ANDINO", "supervisor")
    limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    completar(cliente, login(cliente, "ANDINO", "empleado"), limpieza, reloj)

    cola = cliente.get("/limpiezas", headers=supervisor, params={"estado_revision": "pendiente"})

    assert [item["id"] for item in cola.json()["items"]] == [limpieza]


def test_cp16_regla_riesgo_con_dano_reportado_va_a_revision(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    assert cliente.patch("/empresa", headers=admin, json={"regla_revision": "riesgo"}).is_success
    sin_dano = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    con_dano = asignar(cliente, admin, escenario.a, reloj.hoy_local(), escenario.a.habitacion2_id)
    empleado = login(cliente, "ANDINO", "empleado")

    normal = completar(cliente, empleado, sin_dano, reloj)
    iniciar(cliente, empleado, con_dano)
    dano = cliente.post(
        f"/limpiezas/{con_dano}/danos",
        headers=empleado,
        data={"categoria": "rotura", "gravedad": "urgente", "nota": "Lámpara rota"},
        files=archivo("red"),
    )
    reloj.avanzar(minutes=20)
    foto_salida(cliente, empleado, con_dano)
    revisada = finalizar(cliente, empleado, con_dano)

    assert dano.status_code == 201
    assert normal["estado_revision"] == "no_requerida"
    assert revisada["estado_revision"] == "pendiente"


def test_cp10_dano_sin_foto_o_sin_categoria_no_se_guarda(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)

    sin_foto = cliente.post(
        f"/limpiezas/{limpieza}/danos",
        headers=empleado,
        data={"categoria": "rotura", "gravedad": "leve"},
    )
    sin_categoria = cliente.post(
        f"/limpiezas/{limpieza}/danos", headers=empleado, data={"gravedad": "leve"}, files=archivo()
    )

    assert sin_foto.status_code == 422
    assert sin_categoria.status_code == 422
    campos = {campo["campo"] for campo in sin_categoria.json()["campos"]}
    assert "body.categoria" in campos


def test_cp17_rechazar_exige_comentario_y_crea_una_correccion(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    supervisor = login(cliente, "ANDINO", "supervisor")
    completar(cliente, empleado, limpieza, reloj)

    sin_comentario = cliente.post(
        "/revisiones", headers=supervisor, json={"limpieza_id": limpieza, "resultado": "rechazada"}
    )
    rechazo = cliente.post(
        "/revisiones",
        headers=supervisor,
        json={"limpieza_id": limpieza, "resultado": "rechazada", "comentario": "Falta el baño"},
    )
    repetido = cliente.post(
        "/revisiones", headers=supervisor, json={"limpieza_id": limpieza, "resultado": "aprobada"}
    )
    tareas = cliente.get("/asignaciones/hoy", headers=empleado).json()["items"]

    assert sin_comentario.status_code == 422
    assert rechazo.status_code == 201
    assert repetido.status_code == 409
    correccion = next(t for t in tareas if t["tipo"] == "correccion")
    assert correccion["estado_trabajo"] == "pendiente"
    assert correccion["comentario_rechazo"] == "Falta el baño"
    assert tareas[0]["tipo"] == "correccion"


def test_cp18_cada_cambio_de_estado_de_un_dano_queda_en_el_historial(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)
    dano = cliente.post(
        f"/limpiezas/{limpieza}/danos",
        headers=empleado,
        data={"categoria": "mancha", "gravedad": "leve"},
        files=archivo(),
    ).json()
    supervisor = login(cliente, "ANDINO", "supervisor")

    for estado in ("en_reparacion", "resuelto"):
        cambio = cliente.patch(
            f"/danos/{dano['id']}/estado", headers=supervisor, json={"estado": estado}
        )
        assert cambio.status_code == 200
    detalle = cliente.get(f"/danos/{dano['id']}", headers=supervisor).json()

    pasos = [(h["estado_anterior"], h["estado_nuevo"]) for h in detalle["historial"]]
    assert pasos == [("abierto", "en_reparacion"), ("en_reparacion", "resuelto")]
    assert {h["usuario_id"] for h in detalle["historial"]} == {str(escenario.a.supervisor_id)}


def test_cp19_tiempo_promedio_de_la_habitacion(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    empleado = login(cliente, "ANDINO", "empleado")
    for minutos in (20, 25, 30):
        limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
        completar(cliente, empleado, limpieza, reloj, minutos)
        reloj.avanzar(days=1)

    reporte = cliente.get("/reportes/tiempos/habitaciones", headers=admin).json()["items"]
    pdf = cliente.get("/reportes/tiempos/habitaciones/pdf", headers=admin)

    assert [(f["habitacion_nombre"], f["limpiezas"], f["promedio_seg"]) for f in reporte] == [
        ("101", 3, 1500)
    ]
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


def test_cp20_borrado_de_fotos_vencidas_respeta_las_de_danos_abiertos(
    cliente: TestClient,
    app: FastAPI,
    escenario: Escenario,
    reloj: RelojFalso,
    sql_owner: Session,
) -> None:
    admin = login(cliente, "ANDINO", "admin")
    assert cliente.patch("/empresa", headers=admin, json={"retencion_fotos_dias": 30}).is_success
    limpieza = asignar(cliente, admin, escenario.a, reloj.hoy_local())
    empleado = login(cliente, "ANDINO", "empleado")
    iniciar(cliente, empleado, limpieza)
    dano = cliente.post(
        f"/limpiezas/{limpieza}/danos",
        headers=empleado,
        data={"categoria": "rotura", "gravedad": "urgente"},
        files=archivo(),
    )
    assert dano.status_code == 201
    hace_31_dias = datetime.now(UTC) - timedelta(days=31)
    sql_owner.execute(
        text("UPDATE foto SET tomada_en = :t WHERE limpieza_id = :l"),
        {"t": hace_31_dias, "l": limpieza},
    )
    sql_owner.commit()
    almacen: AlmacenFotos = app.state.almacen

    borradas = borrar_fotos_vencidas(app.state.fabrica_sesiones, almacen, reloj)

    restantes = (
        sql_owner.execute(text("SELECT momento FROM foto WHERE limpieza_id = :l"), {"l": limpieza})
        .scalars()
        .all()
    )
    assert borradas == 1
    assert restantes == ["dano"]


def test_supervisor_solo_revisa_propiedades_a_su_cargo(
    cliente: TestClient, escenario: Escenario, reloj: RelojFalso, sql_owner: Session
) -> None:
    sql_owner.execute(
        text("DELETE FROM supervisor_propiedad WHERE usuario_id = :s"),
        {"s": escenario.a.supervisor_id},
    )
    sql_owner.commit()
    supervisor = login(cliente, "ANDINO", "supervisor")
    limpieza = asignar(cliente, login(cliente, "ANDINO", "admin"), escenario.a, reloj.hoy_local())
    completar(cliente, login(cliente, "ANDINO", "empleado"), limpieza, reloj)

    respuesta = cliente.post(
        "/revisiones",
        headers=supervisor,
        json={"limpieza_id": limpieza, "resultado": "aprobada"},
    )

    assert respuesta.status_code == 404
    assert uuid.UUID(limpieza)
