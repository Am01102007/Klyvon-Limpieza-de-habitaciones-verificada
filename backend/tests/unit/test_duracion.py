from datetime import UTC, datetime

from app.models import Pausa
from app.models.enums import MotivoPausa
from app.services.limpiezas import calcular_duracion_neta


def _hora(hora: int, minuto: int) -> datetime:
    return datetime(2026, 11, 20, hora, minuto, tzinfo=UTC)


def test_cp11_limpieza_de_30_min_con_pausa_de_5_dura_1500_seg() -> None:
    pausa = Pausa(motivo=MotivoPausa.DESCANSO, inicio=_hora(8, 10), fin=_hora(8, 15))

    assert calcular_duracion_neta(_hora(8, 0), _hora(8, 30), [pausa]) == 1500


def test_pausa_sin_cerrar_cuenta_hasta_el_fin() -> None:
    pausa = Pausa(motivo=MotivoPausa.DESCANSO, inicio=_hora(8, 20), fin=None)

    assert calcular_duracion_neta(_hora(8, 0), _hora(8, 30), [pausa]) == 1200


def test_sin_pausas_es_fin_menos_inicio() -> None:
    assert calcular_duracion_neta(_hora(8, 0), _hora(8, 30), []) == 1800
