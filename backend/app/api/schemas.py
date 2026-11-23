import re
import uuid
from collections.abc import Sequence
from datetime import date, datetime, time
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.models.enums import (
    CategoriaDano,
    EstadoDano,
    EstadoRevision,
    EstadoTrabajo,
    GravedadDano,
    Idioma,
    MomentoFoto,
    MotivoPausa,
    ReglaRevision,
    ResultadoRevision,
    Rol,
    TipoClave,
    TipoLimpieza,
    TipoPropiedad,
)

MAX_CLAVE = 128
MIN_CONTRASENA = 6
_PATRON_PIN = re.compile(r"\d{4,6}")

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
NombreCorto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Texto = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
FotosMinimas = Annotated[int, Field(ge=1, le=20)]


def _zona_valida(zona: str) -> str:
    try:
        ZoneInfo(zona)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError("Zona horaria desconocida") from error
    return zona


ZonaHoraria = Annotated[str, StringConstraints(max_length=64), AfterValidator(_zona_valida)]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Salida(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CampoInvalido(BaseModel):
    campo: str
    tipo: str


class ErrorSalida(BaseModel):
    codigo: str
    campos: list[CampoInvalido] | None = None


class PaginaSalida[T](BaseModel):
    items: Sequence[T]
    total: int
    limite: int
    desplazamiento: int


class SaludSalida(BaseModel):
    estado: Literal["ok"]


class ClaveEntrada(Entrada):
    clave: Annotated[str, StringConstraints(max_length=MAX_CLAVE)]
    tipo_clave: TipoClave = TipoClave.CONTRASENA

    @model_validator(mode="after")
    def validar_formato(self) -> Self:
        """HU-02: contraseña de mínimo 6 caracteres o PIN de 4 a 6 dígitos."""
        if self.tipo_clave == TipoClave.PIN and not _PATRON_PIN.fullmatch(self.clave):
            raise ValueError("El PIN debe tener de 4 a 6 dígitos")
        if self.tipo_clave == TipoClave.CONTRASENA and len(self.clave) < MIN_CONTRASENA:
            raise ValueError("La contraseña debe tener mínimo 6 caracteres")
        return self


class LoginEntrada(Entrada):
    codigo_empresa: Annotated[
        str,
        StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=20),
    ]
    nombre_usuario: NombreCorto
    clave: Annotated[str, StringConstraints(min_length=1, max_length=MAX_CLAVE)]


class UsuarioSalida(Salida):
    id: uuid.UUID
    empresa_id: uuid.UUID
    nombre_usuario: str
    tipo_clave: TipoClave
    rol: Rol
    idioma: Idioma
    activo: bool
    creado_en: datetime


class SesionSalida(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    expira_en_seg: int
    usuario: UsuarioSalida


class PerfilEntrada(Entrada):
    idioma: Idioma


class UsuarioEntrada(ClaveEntrada):
    nombre_usuario: NombreCorto
    rol: Rol
    idioma: Idioma | None = None


class UsuarioCambios(Entrada):
    nombre_usuario: NombreCorto | None = None
    idioma: Idioma | None = None
    rol: Rol | None = None
    activo: bool | None = None


class EmpresaSalida(Salida):
    id: uuid.UUID
    nombre: str
    codigo: str
    idioma: Idioma
    plan: str
    regla_revision: ReglaRevision
    muestra_n: int
    retencion_fotos_dias: int


class EmpresaCambios(Entrada):
    nombre: Nombre | None = None
    idioma: Idioma | None = None
    regla_revision: ReglaRevision | None = None
    muestra_n: Annotated[int, Field(ge=1, le=1000)] | None = None
    retencion_fotos_dias: Annotated[int, Field(ge=1, le=3650)] | None = None


class PropiedadEntrada(Entrada):
    nombre: Nombre
    tipo: TipoPropiedad
    direccion: Texto | None = None
    zona_horaria: ZonaHoraria


class PropiedadCambios(Entrada):
    nombre: Nombre | None = None
    tipo: TipoPropiedad | None = None
    direccion: Texto | None = None
    zona_horaria: ZonaHoraria | None = None


class PropiedadSalida(Salida):
    id: uuid.UUID
    nombre: str
    tipo: TipoPropiedad
    direccion: str | None
    zona_horaria: str


class SupervisorVinculo(Entrada):
    usuario_id: uuid.UUID


class HabitacionEntrada(Entrada):
    nombre: NombreCorto
    tipo: NombreCorto | None = None
    fotos_min_entrada: FotosMinimas = 1
    fotos_min_salida: FotosMinimas = 1


class HabitacionCambios(Entrada):
    nombre: NombreCorto | None = None
    tipo: NombreCorto | None = None
    fotos_min_entrada: FotosMinimas | None = None
    fotos_min_salida: FotosMinimas | None = None
    activa: bool | None = None


class HabitacionSalida(Salida):
    id: uuid.UUID
    propiedad_id: uuid.UUID
    nombre: str
    tipo: str | None
    fotos_min_entrada: int
    fotos_min_salida: int
    activa: bool


class AsignacionEntrada(Entrada):
    habitacion_id: uuid.UUID
    empleado_id: uuid.UUID
    fecha: date
    prioridad: Annotated[int, Field(ge=1, le=100, description="1 es la más urgente")] = 1
    hora_limite: time | None = None


class AsignacionCreadaSalida(Salida):
    id: uuid.UUID
    habitacion_id: uuid.UUID
    empleado_id: uuid.UUID
    asignado_por: uuid.UUID
    fecha: date
    prioridad: int
    hora_limite: time | None


class AsignacionSalida(AsignacionCreadaSalida):
    habitacion_nombre: str
    propiedad_id: uuid.UUID
    empleado_nombre: str


class TareaDelDiaSalida(Salida):
    limpieza_id: uuid.UUID
    tipo: TipoLimpieza
    estado_trabajo: EstadoTrabajo
    estado_revision: EstadoRevision
    inicio: datetime | None
    asignacion_id: uuid.UUID
    fecha: date
    prioridad: int
    hora_limite: time | None
    habitacion_id: uuid.UUID
    habitacion_nombre: str
    fotos_min_entrada: int
    fotos_min_salida: int
    propiedad_nombre: str
    zona_horaria: str
    comentario_rechazo: str | None


class LimpiezaSalida(Salida):
    id: uuid.UUID
    asignacion_id: uuid.UUID
    empleado_id: uuid.UUID
    tipo: TipoLimpieza
    limpieza_origen_id: uuid.UUID | None
    inicio: datetime | None
    fin: datetime | None
    duracion_neta_seg: int | None
    estado_trabajo: EstadoTrabajo
    requiere_revision: bool
    estado_revision: EstadoRevision


class LimpiezaResumenSalida(LimpiezaSalida):
    fecha: date
    habitacion_id: uuid.UUID
    habitacion_nombre: str
    propiedad_id: uuid.UUID
    empleado_nombre: str


class FotoSalida(Salida):
    id: uuid.UUID
    limpieza_id: uuid.UUID
    dano_id: uuid.UUID | None
    momento: MomentoFoto
    url: str
    tomada_en: datetime
    tamano_kb: int


class PausaEntrada(Entrada):
    motivo: MotivoPausa
    id: Annotated[
        uuid.UUID | None, Field(description="Generado en el teléfono: evita duplicados")
    ] = None


class PausaSalida(Salida):
    id: uuid.UUID
    limpieza_id: uuid.UUID
    motivo: MotivoPausa
    inicio: datetime
    fin: datetime | None


class DanoSalida(Salida):
    id: uuid.UUID
    limpieza_id: uuid.UUID
    categoria: CategoriaDano
    gravedad: GravedadDano
    nota: str | None
    estado: EstadoDano
    creado_en: datetime


class DanoResumenSalida(DanoSalida):
    habitacion_id: uuid.UUID
    habitacion_nombre: str
    propiedad_id: uuid.UUID


class DanoEstadoEntrada(Entrada):
    estado: EstadoDano


class DanoHistorialSalida(Salida):
    id: uuid.UUID
    usuario_id: uuid.UUID
    estado_anterior: EstadoDano
    estado_nuevo: EstadoDano
    cambiado_en: datetime


class DetalleDanoSalida(Salida):
    dano: DanoSalida
    propiedad_id: uuid.UUID
    fotos: Sequence[FotoSalida]
    historial: Sequence[DanoHistorialSalida]


class RevisionEntrada(Entrada):
    limpieza_id: uuid.UUID
    resultado: ResultadoRevision
    comentario: Texto | None = None

    @model_validator(mode="after")
    def exigir_comentario_si_rechaza(self) -> Self:
        """RF-12, CP-17."""
        if self.resultado == ResultadoRevision.RECHAZADA and not self.comentario:
            raise ValueError("Rechazar exige un comentario")
        return self


class RevisionSalida(Salida):
    id: uuid.UUID
    limpieza_id: uuid.UUID
    supervisor_id: uuid.UUID
    resultado: ResultadoRevision
    comentario: str | None
    revisado_en: datetime


class DetalleLimpiezaSalida(Salida):
    limpieza: LimpiezaSalida
    habitacion_nombre: str
    fecha: date
    fotos: Sequence[FotoSalida]
    pausas: Sequence[PausaSalida]
    danos: Sequence[DanoSalida]
    revision: RevisionSalida | None


class TiempoHabitacionSalida(Salida):
    habitacion_id: uuid.UUID
    habitacion_nombre: str
    propiedad_nombre: str
    promedio_seg: float
    limpiezas: int


class TiempoEmpleadoSalida(Salida):
    empleado_id: uuid.UUID
    empleado_nombre: str
    promedio_seg: float
    limpiezas: int


class DanosPropiedadSalida(Salida):
    propiedad_id: uuid.UUID
    propiedad_nombre: str
    total: int
    abiertos: int
    en_reparacion: int
    resueltos: int
    urgentes: int
