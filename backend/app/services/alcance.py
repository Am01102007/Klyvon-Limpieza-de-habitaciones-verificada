import uuid
from collections.abc import Sequence

from app.core.exceptions import NoEncontrado
from app.models import Usuario
from app.models.enums import Rol
from app.repositories.propiedades import PropiedadRepository


def propiedades_visibles(
    actor: Usuario, propiedades: PropiedadRepository
) -> Sequence[uuid.UUID] | None:
    """None significa todas las de la empresa (administrador)."""
    if actor.rol == Rol.ADMIN:
        return None
    return propiedades.ids_de_supervisor(actor.id)


def exigir_propiedad_visible(
    actor: Usuario, propiedad_id: uuid.UUID, propiedades: PropiedadRepository
) -> None:
    visibles = propiedades_visibles(actor, propiedades)
    if visibles is not None and propiedad_id not in visibles:
        raise NoEncontrado
