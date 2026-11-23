from unittest.mock import MagicMock

import pytest

from app.core.exceptions import ServicioNoDisponible
from app.repositories.salud import SaludRepository
from app.services.salud import SaludService


def test_comprobar_no_falla_si_la_base_responde() -> None:
    repositorio = MagicMock(spec=SaludRepository)
    repositorio.base_disponible.return_value = True

    SaludService(repositorio).comprobar()


def test_comprobar_lanza_error_de_dominio_si_la_base_no_responde() -> None:
    repositorio = MagicMock(spec=SaludRepository)
    repositorio.base_disponible.return_value = False

    with pytest.raises(ServicioNoDisponible):
        SaludService(repositorio).comprobar()
