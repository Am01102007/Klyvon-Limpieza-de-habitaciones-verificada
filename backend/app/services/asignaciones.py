import uuid
from dataclasses import dataclass
from datetime import date, time
from typing import Any
from zoneinfo import ZoneInfo

from app.core.database import Transaccion
from app.core.exceptions import EntradaInvalida, NoEncontrado
from app.core.paginacion import Pagina, Paginacion
from app.core.reloj import Reloj
from app.models import Asignacion, Limpieza, Usuario
from app.models.enums import Rol
from app.repositories.asignaciones import AsignacionRepository
from app.repositories.propiedades import PropiedadRepository
from app.repositories.usuarios import UsuarioRepository
from app.services.alcance import exigir_propiedad_visible, propiedades_visibles


@dataclass(frozen=True)
class DatosAsignacion:
    habitacion_id: uuid.UUID
    empleado_id: uuid.UUID
    fecha: date
    prioridad: int
    hora_limite: time | None


class AsignacionService:
    def __init__(
        self,
        tx: Transaccion,
        asignaciones: AsignacionRepository,
        propiedades: PropiedadRepository,
        usuarios: UsuarioRepository,
        reloj: Reloj,
    ) -> None:
        self._tx = tx
        self._asignaciones = asignaciones
        self._propiedades = propiedades
        self._usuarios = usuarios
        self._reloj = reloj

    def crear(self, actor: Usuario, datos: DatosAsignacion) -> Asignacion:
        """RF-05, HU-04 y CP-06. La limpieza nace pendiente en la misma transacción."""
        habitacion = self._propiedades.obtener_habitacion(datos.habitacion_id)
        if habitacion is None or not habitacion.activa:
            raise NoEncontrado
        exigir_propiedad_visible(actor, habitacion.propiedad_id, self._propiedades)
        empleado = self._usuarios.obtener(datos.empleado_id)
        if empleado is None or not empleado.activo or empleado.rol != Rol.EMPLEADO:
            raise NoEncontrado
        propiedad = self._propiedades.obtener(habitacion.propiedad_id)
        if propiedad is None:
            raise NoEncontrado
        hoy = self._reloj.ahora().astimezone(ZoneInfo(propiedad.zona_horaria)).date()
        if datos.fecha < hoy:
            raise EntradaInvalida("fecha_pasada")

        asignacion = self._asignaciones.agregar(
            Asignacion(
                empresa_id=actor.empresa_id,
                habitacion_id=datos.habitacion_id,
                empleado_id=datos.empleado_id,
                asignado_por=actor.id,
                fecha=datos.fecha,
                prioridad=datos.prioridad,
                hora_limite=datos.hora_limite,
            ),
            "asignacion_duplicada",
        )
        self._asignaciones.agregar(
            Limpieza(
                empresa_id=actor.empresa_id,
                asignacion_id=asignacion.id,
                empleado_id=datos.empleado_id,
            )
        )
        self._tx.confirmar()
        return asignacion

    def listar(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        fecha: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        visibles = propiedades_visibles(actor, self._propiedades)
        return self._asignaciones.listar(paginacion, visibles, fecha, propiedad_id, empleado_id)

    def tareas_de_hoy(self, actor: Usuario, paginacion: Paginacion) -> Pagina[Any]:
        """RF-06, CU-02."""
        return self._asignaciones.tareas_de_hoy(actor.id, self._reloj.ahora(), paginacion)
