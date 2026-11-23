"""Datos de desarrollo: dos empresas con la estructura del plan de pruebas de la especificación.

Se ejecuta desde `backend/` con `python -m scripts.semilla` y usa el rol dueño del esquema.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import SemillaSettings
from app.core.seguridad import generar_hash_clave
from app.models import (
    CLASE_POR_ROL,
    Asignacion,
    Empresa,
    Habitacion,
    Limpieza,
    Propiedad,
    SupervisorPropiedad,
    Usuario,
)
from app.models.enums import Rol, TipoClave, TipoPropiedad

_ZONA = "America/Bogota"
_EMPRESAS = (("Hotel Andino", "ANDINO"), ("Estadías del Sur", "SUR"))


def _crear_usuario(
    sesion: Session, empresa: Empresa, nombre: str, rol: Rol, hash_clave: str
) -> Usuario:
    usuario = CLASE_POR_ROL[rol](
        empresa_id=empresa.id,
        nombre_usuario=nombre,
        hash_clave=hash_clave,
        tipo_clave=TipoClave.CONTRASENA,
        idioma=empresa.idioma,
    )
    sesion.add(usuario)
    return usuario


def _crear_empresa(sesion: Session, nombre: str, codigo: str, hash_clave: str) -> None:
    empresa = Empresa(nombre=nombre, codigo=codigo)
    sesion.add(empresa)
    sesion.flush()

    admin = _crear_usuario(sesion, empresa, "admin", Rol.ADMIN, hash_clave)
    supervisor = _crear_usuario(sesion, empresa, "supervisor", Rol.SUPERVISOR, hash_clave)
    empleados = [
        _crear_usuario(sesion, empresa, f"empleado{numero}", Rol.EMPLEADO, hash_clave)
        for numero in (1, 2, 3)
    ]
    hotel = Propiedad(
        empresa_id=empresa.id, nombre="Hotel Centro", tipo=TipoPropiedad.HOTEL, zona_horaria=_ZONA
    )
    airbnb = Propiedad(
        empresa_id=empresa.id,
        nombre="Apartamento Mar",
        tipo=TipoPropiedad.AIRBNB,
        zona_horaria=_ZONA,
    )
    sesion.add_all([hotel, airbnb])
    sesion.flush()

    habitaciones = [
        Habitacion(empresa_id=empresa.id, propiedad_id=hotel.id, nombre=nombre_habitacion)
        for nombre_habitacion in ("101", "102", "103")
    ] + [
        Habitacion(empresa_id=empresa.id, propiedad_id=airbnb.id, nombre=nombre_habitacion)
        for nombre_habitacion in ("Principal", "Secundaria")
    ]
    sesion.add_all(habitaciones)
    for propiedad in (hotel, airbnb):
        sesion.add(
            SupervisorPropiedad(
                empresa_id=empresa.id, usuario_id=supervisor.id, propiedad_id=propiedad.id
            )
        )
    sesion.flush()

    hoy = datetime.now(ZoneInfo(_ZONA)).date()
    for prioridad, habitacion in enumerate(habitaciones[:2], start=1):
        asignacion = Asignacion(
            empresa_id=empresa.id,
            habitacion_id=habitacion.id,
            empleado_id=empleados[0].id,
            asignado_por=admin.id,
            fecha=hoy,
            prioridad=prioridad,
        )
        sesion.add(asignacion)
        sesion.flush()
        sesion.add(
            Limpieza(
                empresa_id=empresa.id,
                asignacion_id=asignacion.id,
                empleado_id=asignacion.empleado_id,
            )
        )


def main() -> None:
    ajustes = SemillaSettings()
    url = ajustes.migration_database_url.get_secret_value()
    hash_clave = generar_hash_clave(ajustes.semilla_clave.get_secret_value())
    with Session(create_engine(url)) as sesion:
        for nombre, codigo in _EMPRESAS:
            if sesion.scalar(select(Empresa.id).where(Empresa.codigo == codigo)) is None:
                _crear_empresa(sesion, nombre, codigo, hash_clave)
                print(f"Empresa creada: {codigo}")
        sesion.commit()


if __name__ == "__main__":
    main()
