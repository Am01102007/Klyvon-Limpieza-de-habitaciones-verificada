import random
from datetime import UTC, datetime, timedelta

from app.models.enums import ReglaRevision
from app.services.reglas_revision import DatosRevision, crear_estrategia

_AHORA = datetime(2026, 11, 20, 12, tzinfo=UTC)
_VETERANO = _AHORA - timedelta(days=60)


def _datos(**cambios: object) -> DatosRevision:
    base: dict[str, object] = {
        "empleado_creado_en": _VETERANO,
        "ahora": _AHORA,
        "tiene_danos": False,
        "duracion_neta_seg": 1500,
        "promedio_habitacion_seg": 1500.0,
    }
    base.update(cambios)
    return DatosRevision(**base)  # type: ignore[arg-type]


def test_cp14_regla_todo_manda_todas_a_revision() -> None:
    estrategia = crear_estrategia(ReglaRevision.TODO, 5, random.Random(1))

    assert all(estrategia.requiere_revision(_datos()) for _ in range(10))


def test_cp15_muestra_1_de_5_con_semilla_fija_queda_entre_15_y_25_de_100() -> None:
    estrategia = crear_estrategia(ReglaRevision.MUESTRA, 5, random.Random(42))

    revisadas = sum(estrategia.requiere_revision(_datos()) for _ in range(100))

    assert 15 <= revisadas <= 25


def test_cp15_muestra_converge_a_1_de_cada_n() -> None:
    estrategia = crear_estrategia(ReglaRevision.MUESTRA, 5, random.Random(7))

    revisadas = sum(estrategia.requiere_revision(_datos()) for _ in range(10_000))

    assert 1900 <= revisadas <= 2100


def test_cp16_riesgo_marca_empleado_nuevo() -> None:
    estrategia = crear_estrategia(ReglaRevision.RIESGO, 5, random.Random(1))

    assert estrategia.requiere_revision(_datos(empleado_creado_en=_AHORA - timedelta(days=13)))


def test_cp16_riesgo_marca_limpieza_con_dano() -> None:
    estrategia = crear_estrategia(ReglaRevision.RIESGO, 5, random.Random(1))

    assert estrategia.requiere_revision(_datos(tiene_danos=True))


def test_cp16_riesgo_marca_limpieza_40_por_ciento_mas_rapida() -> None:
    estrategia = crear_estrategia(ReglaRevision.RIESGO, 5, random.Random(1))

    assert estrategia.requiere_revision(
        _datos(duracion_neta_seg=590, promedio_habitacion_seg=1000.0)
    )


def test_cp16_riesgo_no_marca_limpieza_normal_ni_sin_promedio() -> None:
    estrategia = crear_estrategia(ReglaRevision.RIESGO, 5, random.Random(1))

    assert not estrategia.requiere_revision(_datos(duracion_neta_seg=900))
    assert not estrategia.requiere_revision(_datos(promedio_habitacion_seg=None))
