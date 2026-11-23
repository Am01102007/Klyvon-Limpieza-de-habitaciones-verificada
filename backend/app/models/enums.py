from enum import StrEnum

from sqlalchemy import Enum


class Rol(StrEnum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    EMPLEADO = "empleado"


class TipoClave(StrEnum):
    CONTRASENA = "contrasena"
    PIN = "pin"


class Idioma(StrEnum):
    ES = "es"
    EN = "en"
    PT = "pt"


class ReglaRevision(StrEnum):
    TODO = "todo"
    MUESTRA = "muestra"
    RIESGO = "riesgo"


class TipoPropiedad(StrEnum):
    HOTEL = "hotel"
    AIRBNB = "airbnb"


class TipoLimpieza(StrEnum):
    NORMAL = "normal"
    CORRECCION = "correccion"


class EstadoTrabajo(StrEnum):
    PENDIENTE = "pendiente"
    EN_CURSO = "en_curso"
    ENVIADA = "enviada"


class EstadoRevision(StrEnum):
    NO_REQUERIDA = "no_requerida"
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class ResultadoRevision(StrEnum):
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class MotivoPausa(StrEnum):
    DESCANSO = "descanso"
    FALTA_INSUMOS = "falta_insumos"
    HUESPED_EN_HABITACION = "huesped_en_habitacion"


class CategoriaDano(StrEnum):
    ROTURA = "rotura"
    MANCHA = "mancha"
    FALTANTE = "faltante"
    APARATO = "aparato"
    OTRO = "otro"


class GravedadDano(StrEnum):
    LEVE = "leve"
    URGENTE = "urgente"


class EstadoDano(StrEnum):
    ABIERTO = "abierto"
    EN_REPARACION = "en_reparacion"
    RESUELTO = "resuelto"


class MomentoFoto(StrEnum):
    ENTRADA = "entrada"
    SALIDA = "salida"
    DANO = "dano"


def columna_enum(enum: type[StrEnum], nombre: str) -> Enum:
    """VARCHAR con CHECK, como define el modelo relacional de la especificación."""
    return Enum(
        enum,
        name=nombre,
        native_enum=False,
        create_constraint=True,
        length=30,
        values_callable=lambda miembros: [miembro.value for miembro in miembros],
    )
