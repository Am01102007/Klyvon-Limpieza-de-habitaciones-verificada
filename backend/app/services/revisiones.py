import uuid

from app.core.database import Transaccion
from app.core.exceptions import Conflicto, NoEncontrado
from app.core.reloj import Reloj
from app.models import Limpieza, Revision, Usuario
from app.models.enums import EstadoRevision, ResultadoRevision, TipoLimpieza
from app.repositories.limpiezas import LimpiezaRepository
from app.repositories.propiedades import PropiedadRepository
from app.services.alcance import exigir_propiedad_visible

_ESTADO_POR_RESULTADO = {
    ResultadoRevision.APROBADA: EstadoRevision.APROBADA,
    ResultadoRevision.RECHAZADA: EstadoRevision.RECHAZADA,
}


class RevisionService:
    def __init__(
        self,
        tx: Transaccion,
        limpiezas: LimpiezaRepository,
        propiedades: PropiedadRepository,
        reloj: Reloj,
    ) -> None:
        self._tx = tx
        self._limpiezas = limpiezas
        self._propiedades = propiedades
        self._reloj = reloj

    def revisar(
        self,
        actor: Usuario,
        limpieza_id: uuid.UUID,
        resultado: ResultadoRevision,
        comentario: str | None,
    ) -> Revision:
        """RF-12, RF-13 y CP-17: el rechazo crea la corrección en la misma transacción."""
        contexto = self._limpiezas.obtener_contexto(limpieza_id, para_actualizar=True)
        if contexto is None:
            raise NoEncontrado
        exigir_propiedad_visible(actor, contexto.habitacion.propiedad_id, self._propiedades)
        limpieza = contexto.limpieza
        if limpieza.estado_revision != EstadoRevision.PENDIENTE:
            raise Conflicto("limpieza_no_esta_por_revisar")

        revision = self._limpiezas.agregar(
            Revision(
                empresa_id=actor.empresa_id,
                limpieza_id=limpieza_id,
                supervisor_id=actor.id,
                resultado=resultado,
                comentario=comentario,
                revisado_en=self._reloj.ahora(),
            ),
            "limpieza_no_esta_por_revisar",
        )
        limpieza.estado_revision = _ESTADO_POR_RESULTADO[resultado]
        if resultado == ResultadoRevision.RECHAZADA:
            self._limpiezas.agregar(
                Limpieza(
                    empresa_id=actor.empresa_id,
                    asignacion_id=limpieza.asignacion_id,
                    empleado_id=limpieza.empleado_id,
                    tipo=TipoLimpieza.CORRECCION,
                    limpieza_origen_id=limpieza.id,
                )
            )
        self._tx.confirmar()
        return revision
