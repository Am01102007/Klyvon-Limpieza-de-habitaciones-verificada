import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from app.core.almacen_fotos import AlmacenFotos
from app.core.database import Transaccion
from app.core.exceptions import Conflicto, NoEncontrado
from app.core.paginacion import Pagina, Paginacion
from app.core.reloj import Reloj
from app.models import Dano, DanoHistorial, Usuario
from app.models.enums import EstadoDano
from app.repositories.danos import DanoConPropiedad, DanoRepository
from app.repositories.propiedades import PropiedadRepository
from app.services.alcance import exigir_propiedad_visible, propiedades_visibles
from app.services.limpiezas import FotoVista, vista_de_foto


@dataclass(frozen=True)
class DetalleDano:
    dano: Dano
    propiedad_id: uuid.UUID
    fotos: Sequence[FotoVista]
    historial: Sequence[DanoHistorial]


class DanoService:
    def __init__(
        self,
        tx: Transaccion,
        danos: DanoRepository,
        propiedades: PropiedadRepository,
        almacen: AlmacenFotos,
        reloj: Reloj,
    ) -> None:
        self._tx = tx
        self._danos = danos
        self._propiedades = propiedades
        self._almacen = almacen
        self._reloj = reloj

    def listar(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        estado: EstadoDano | None,
        propiedad_id: uuid.UUID | None,
    ) -> Pagina[Any]:
        visibles = propiedades_visibles(actor, self._propiedades)
        return self._danos.listar(paginacion, visibles, estado, propiedad_id)

    def detalle(self, actor: Usuario, dano_id: uuid.UUID) -> DetalleDano:
        encontrado = self._visible(actor, self._danos.obtener(dano_id))
        return self._detalle(encontrado)

    def cambiar_estado(self, actor: Usuario, dano_id: uuid.UUID, estado: EstadoDano) -> DetalleDano:
        """RF-14, CP-18: cada cambio deja un registro con usuario y fecha."""
        encontrado = self._visible(actor, self._danos.obtener(dano_id, para_actualizar=True))
        dano = encontrado.dano
        if dano.estado == estado:
            raise Conflicto("dano_ya_en_ese_estado")
        self._danos.agregar(
            DanoHistorial(
                empresa_id=actor.empresa_id,
                dano_id=dano.id,
                usuario_id=actor.id,
                estado_anterior=dano.estado,
                estado_nuevo=estado,
                cambiado_en=self._reloj.ahora(),
            )
        )
        dano.estado = estado
        self._tx.confirmar()
        return self._detalle(encontrado)

    def _visible(self, actor: Usuario, encontrado: DanoConPropiedad | None) -> DanoConPropiedad:
        if encontrado is None:
            raise NoEncontrado
        exigir_propiedad_visible(actor, encontrado.propiedad_id, self._propiedades)
        return encontrado

    def _detalle(self, encontrado: DanoConPropiedad) -> DetalleDano:
        ahora = self._reloj.ahora()
        return DetalleDano(
            dano=encontrado.dano,
            propiedad_id=encontrado.propiedad_id,
            fotos=[
                vista_de_foto(foto, self._almacen, ahora)
                for foto in self._danos.fotos(encontrado.dano.id)
            ],
            historial=self._danos.historial(encontrado.dano.id),
        )
