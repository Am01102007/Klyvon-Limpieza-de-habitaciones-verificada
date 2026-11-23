import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from typing import Any
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from PIL import Image

ZONA = "America/Bogota"
CLAVE = "clave-segura-1"
Cabeceras = dict[str, str]


class RelojFalso:
    """RNF-06: el servidor manda en la hora; en las pruebas la controla la prueba.

    Ojo: los JWT se validan con el reloj real (PyJWT rechaza `iat` futuros), así que los
    usuarios inician sesión antes de que la prueba adelante este reloj.
    """

    def __init__(self) -> None:
        self.momento = datetime.now(UTC)

    def ahora(self) -> datetime:
        return self.momento

    def avanzar(self, **delta: float) -> None:
        self.momento += timedelta(**delta)

    def hoy_local(self) -> date:
        return self.momento.astimezone(ZoneInfo(ZONA)).date()


@dataclass(frozen=True)
class DatosEmpresa:
    id: uuid.UUID
    codigo: str
    admin_id: uuid.UUID
    supervisor_id: uuid.UUID
    empleado_id: uuid.UUID
    empleado2_id: uuid.UUID
    propiedad_id: uuid.UUID
    habitacion_id: uuid.UUID
    habitacion2_id: uuid.UUID


@dataclass(frozen=True)
class Escenario:
    a: DatosEmpresa
    b: DatosEmpresa


def login(cliente: TestClient, codigo: str, usuario: str, clave: str = CLAVE) -> Cabeceras:
    respuesta = cliente.post(
        "/auth/login",
        json={"codigo_empresa": codigo, "nombre_usuario": usuario, "clave": clave},
    )
    assert respuesta.status_code == 200, respuesta.text
    return {"Authorization": f"Bearer {respuesta.json()['access_token']}"}


def foto_jpeg(color: str = "white") -> bytes:
    salida = BytesIO()
    Image.new("RGB", (64, 64), color).save(salida, format="JPEG")
    return salida.getvalue()


def archivo(color: str = "white") -> dict[str, tuple[str, bytes, str]]:
    return {"archivo": ("foto.jpg", foto_jpeg(color), "image/jpeg")}


def asignar(
    cliente: TestClient,
    gestor: Cabeceras,
    empresa: DatosEmpresa,
    fecha: date,
    habitacion_id: uuid.UUID | None = None,
    empleado_id: uuid.UUID | None = None,
) -> str:
    """Crea la asignación (RF-05) y devuelve el id de la limpieza que nace pendiente."""
    creada = cliente.post(
        "/asignaciones",
        headers=gestor,
        json={
            "habitacion_id": str(habitacion_id or empresa.habitacion_id),
            "empleado_id": str(empleado_id or empresa.empleado_id),
            "fecha": fecha.isoformat(),
        },
    )
    assert creada.status_code == 201, creada.text
    asignacion_id = creada.json()["id"]
    lista = cliente.get(
        "/limpiezas",
        headers=gestor,
        params={"desde": fecha.isoformat(), "hasta": fecha.isoformat(), "limite": 100},
    )
    assert lista.status_code == 200, lista.text
    limpiezas = [
        item["id"]
        for item in lista.json()["items"]
        if item["asignacion_id"] == asignacion_id and item["tipo"] == "normal"
    ]
    assert len(limpiezas) == 1
    return str(limpiezas[0])


def iniciar(cliente: TestClient, empleado: Cabeceras, limpieza_id: str) -> Any:
    respuesta = cliente.post(f"/limpiezas/{limpieza_id}/iniciar", headers=empleado, files=archivo())
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def foto_salida(cliente: TestClient, empleado: Cabeceras, limpieza_id: str) -> None:
    respuesta = cliente.post(
        f"/limpiezas/{limpieza_id}/fotos",
        headers=empleado,
        data={"momento": "salida"},
        files=archivo("gray"),
    )
    assert respuesta.status_code == 201, respuesta.text


def finalizar(cliente: TestClient, empleado: Cabeceras, limpieza_id: str) -> Any:
    respuesta = cliente.post(f"/limpiezas/{limpieza_id}/finalizar", headers=empleado)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def completar(
    cliente: TestClient,
    empleado: Cabeceras,
    limpieza_id: str,
    reloj: RelojFalso,
    minutos: float = 20,
) -> Any:
    """Flujo mínimo de una limpieza: foto de entrada, foto de salida y finalizar."""
    iniciar(cliente, empleado, limpieza_id)
    reloj.avanzar(minutes=minutos)
    foto_salida(cliente, empleado, limpieza_id)
    return finalizar(cliente, empleado, limpieza_id)
