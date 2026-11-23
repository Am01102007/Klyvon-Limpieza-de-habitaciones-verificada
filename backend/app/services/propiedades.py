import uuid
from dataclasses import dataclass

from app.core.database import Transaccion
from app.core.exceptions import EntradaInvalida, NoEncontrado
from app.core.paginacion import Pagina, Paginacion
from app.models import Habitacion, Propiedad, SupervisorPropiedad, Usuario
from app.models.enums import Rol, TipoPropiedad
from app.repositories.propiedades import PropiedadRepository
from app.repositories.usuarios import UsuarioRepository
from app.services.alcance import exigir_propiedad_visible, propiedades_visibles


@dataclass(frozen=True)
class CambiosPropiedad:
    nombre: str | None = None
    tipo: TipoPropiedad | None = None
    direccion: str | None = None
    zona_horaria: str | None = None


@dataclass(frozen=True)
class DatosHabitacion:
    nombre: str
    tipo: str | None
    fotos_min_entrada: int
    fotos_min_salida: int


@dataclass(frozen=True)
class CambiosHabitacion:
    nombre: str | None = None
    tipo: str | None = None
    fotos_min_entrada: int | None = None
    fotos_min_salida: int | None = None
    activa: bool | None = None


class PropiedadService:
    def __init__(
        self, tx: Transaccion, propiedades: PropiedadRepository, usuarios: UsuarioRepository
    ) -> None:
        self._tx = tx
        self._propiedades = propiedades
        self._usuarios = usuarios

    def listar(self, actor: Usuario, paginacion: Paginacion) -> Pagina[Propiedad]:
        return self._propiedades.listar(paginacion, propiedades_visibles(actor, self._propiedades))

    def obtener(self, actor: Usuario, propiedad_id: uuid.UUID) -> Propiedad:
        propiedad = self._propiedades.obtener(propiedad_id)
        if propiedad is None:
            raise NoEncontrado
        exigir_propiedad_visible(actor, propiedad_id, self._propiedades)
        return propiedad

    def crear(
        self,
        actor: Usuario,
        nombre: str,
        tipo: TipoPropiedad,
        direccion: str | None,
        zona_horaria: str,
    ) -> Propiedad:
        """RF-04."""
        propiedad = self._propiedades.agregar(
            Propiedad(
                empresa_id=actor.empresa_id,
                nombre=nombre,
                tipo=tipo,
                direccion=direccion,
                zona_horaria=zona_horaria,
            )
        )
        self._tx.confirmar()
        return propiedad

    def actualizar(
        self, actor: Usuario, propiedad_id: uuid.UUID, cambios: CambiosPropiedad
    ) -> Propiedad:
        propiedad = self.obtener(actor, propiedad_id)
        if cambios.nombre is not None:
            propiedad.nombre = cambios.nombre
        if cambios.tipo is not None:
            propiedad.tipo = cambios.tipo
        if cambios.direccion is not None:
            propiedad.direccion = cambios.direccion
        if cambios.zona_horaria is not None:
            propiedad.zona_horaria = cambios.zona_horaria
        self._tx.confirmar()
        return propiedad

    def supervisores(
        self, actor: Usuario, propiedad_id: uuid.UUID, paginacion: Paginacion
    ) -> Pagina[Usuario]:
        self.obtener(actor, propiedad_id)
        return self._propiedades.supervisores(propiedad_id, paginacion)

    def vincular_supervisor(
        self, actor: Usuario, propiedad_id: uuid.UUID, usuario_id: uuid.UUID
    ) -> None:
        self.obtener(actor, propiedad_id)
        usuario = self._usuarios.obtener(usuario_id)
        if usuario is None:
            raise NoEncontrado
        if usuario.rol != Rol.SUPERVISOR:
            raise EntradaInvalida("usuario_no_es_supervisor")
        self._propiedades.agregar(
            SupervisorPropiedad(
                empresa_id=actor.empresa_id, usuario_id=usuario_id, propiedad_id=propiedad_id
            ),
            "supervisor_ya_vinculado",
        )
        self._tx.confirmar()

    def desvincular_supervisor(
        self, actor: Usuario, propiedad_id: uuid.UUID, usuario_id: uuid.UUID
    ) -> None:
        self.obtener(actor, propiedad_id)
        vinculo = self._propiedades.vinculo_supervisor(propiedad_id, usuario_id)
        if vinculo is None:
            raise NoEncontrado
        self._propiedades.eliminar_vinculo(vinculo)
        self._tx.confirmar()

    def listar_habitaciones(
        self, actor: Usuario, propiedad_id: uuid.UUID, paginacion: Paginacion
    ) -> Pagina[Habitacion]:
        self.obtener(actor, propiedad_id)
        return self._propiedades.listar_habitaciones(propiedad_id, paginacion)

    def obtener_habitacion(self, actor: Usuario, habitacion_id: uuid.UUID) -> Habitacion:
        habitacion = self._propiedades.obtener_habitacion(habitacion_id)
        if habitacion is None:
            raise NoEncontrado
        exigir_propiedad_visible(actor, habitacion.propiedad_id, self._propiedades)
        return habitacion

    def crear_habitacion(
        self, actor: Usuario, propiedad_id: uuid.UUID, datos: DatosHabitacion
    ) -> Habitacion:
        """RF-04, HU-03."""
        self.obtener(actor, propiedad_id)
        habitacion = self._propiedades.agregar(
            Habitacion(
                empresa_id=actor.empresa_id,
                propiedad_id=propiedad_id,
                nombre=datos.nombre,
                tipo=datos.tipo,
                fotos_min_entrada=datos.fotos_min_entrada,
                fotos_min_salida=datos.fotos_min_salida,
            ),
            "habitacion_duplicada",
        )
        self._tx.confirmar()
        return habitacion

    def actualizar_habitacion(
        self, actor: Usuario, habitacion_id: uuid.UUID, cambios: CambiosHabitacion
    ) -> Habitacion:
        habitacion = self.obtener_habitacion(actor, habitacion_id)
        if cambios.nombre is not None:
            habitacion.nombre = cambios.nombre
        if cambios.tipo is not None:
            habitacion.tipo = cambios.tipo
        if cambios.fotos_min_entrada is not None:
            habitacion.fotos_min_entrada = cambios.fotos_min_entrada
        if cambios.fotos_min_salida is not None:
            habitacion.fotos_min_salida = cambios.fotos_min_salida
        if cambios.activa is not None:
            habitacion.activa = cambios.activa
        self._propiedades.guardar("habitacion_duplicada")
        self._tx.confirmar()
        return habitacion
