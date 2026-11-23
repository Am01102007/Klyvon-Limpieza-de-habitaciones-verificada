import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.core.paginacion import Pagina, Paginacion
from app.core.pdf import generar_pdf_tabla
from app.core.reloj import Reloj
from app.models import Usuario
from app.models.enums import Idioma
from app.services.reportes import ReporteService

_MAX_FILAS = 5000


@dataclass(frozen=True)
class TextosReporte:
    titulo: str
    columnas: Sequence[str]


@dataclass(frozen=True)
class TextosPdf:
    generado: str
    periodo: str
    todo: str
    mostrando: str
    habitaciones: TextosReporte
    empleados: TextosReporte
    danos: TextosReporte


_TEXTOS = {
    Idioma.ES: TextosPdf(
        generado="Generado",
        periodo="Periodo",
        todo="todo",
        mostrando="Filas incluidas",
        habitaciones=TextosReporte(
            "Tiempo promedio por habitación",
            ("Propiedad", "Habitación", "Promedio (min)", "Limpiezas"),
        ),
        empleados=TextosReporte(
            "Tiempo promedio por empleado", ("Empleado", "Promedio (min)", "Limpiezas")
        ),
        danos=TextosReporte(
            "Daños por propiedad",
            ("Propiedad", "Total", "Abiertos", "En reparación", "Resueltos", "Urgentes"),
        ),
    ),
    Idioma.EN: TextosPdf(
        generado="Generated",
        periodo="Period",
        todo="all",
        mostrando="Rows included",
        habitaciones=TextosReporte(
            "Average time per room", ("Property", "Room", "Average (min)", "Cleanings")
        ),
        empleados=TextosReporte(
            "Average time per employee", ("Employee", "Average (min)", "Cleanings")
        ),
        danos=TextosReporte(
            "Damage per property",
            ("Property", "Total", "Open", "In repair", "Resolved", "Urgent"),
        ),
    ),
    Idioma.PT: TextosPdf(
        generado="Gerado",
        periodo="Período",
        todo="tudo",
        mostrando="Linhas incluídas",
        habitaciones=TextosReporte(
            "Tempo médio por quarto", ("Propriedade", "Quarto", "Média (min)", "Limpezas")
        ),
        empleados=TextosReporte(
            "Tempo médio por funcionário", ("Funcionário", "Média (min)", "Limpezas")
        ),
        danos=TextosReporte(
            "Danos por propriedade",
            ("Propriedade", "Total", "Abertos", "Em reparo", "Resolvidos", "Urgentes"),
        ),
    ),
}


def _minutos(segundos: float) -> str:
    return f"{float(segundos) / 60:.1f}"


class ReportePdfService:
    """RF-17: exporta a PDF los mismos reportes, con los mismos permisos."""

    def __init__(self, reportes: ReporteService, reloj: Reloj) -> None:
        self._reportes = reportes
        self._reloj = reloj

    def tiempos_por_habitacion(
        self,
        actor: Usuario,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> bytes:
        pagina = self._reportes.tiempos_por_habitacion(
            actor, Paginacion(_MAX_FILAS), desde, hasta, propiedad_id, empleado_id
        )
        filas = [
            (f.propiedad_nombre, f.habitacion_nombre, _minutos(f.promedio_seg), str(f.limpiezas))
            for f in pagina.items
        ]
        textos = _TEXTOS[actor.idioma]
        return self._generar(textos, textos.habitaciones, pagina, filas, desde, hasta)

    def tiempos_por_empleado(
        self,
        actor: Usuario,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
    ) -> bytes:
        pagina = self._reportes.tiempos_por_empleado(
            actor, Paginacion(_MAX_FILAS), desde, hasta, propiedad_id, empleado_id
        )
        filas = [
            (f.empleado_nombre, _minutos(f.promedio_seg), str(f.limpiezas)) for f in pagina.items
        ]
        textos = _TEXTOS[actor.idioma]
        return self._generar(textos, textos.empleados, pagina, filas, desde, hasta)

    def danos_por_propiedad(
        self,
        actor: Usuario,
        desde: date | None,
        hasta: date | None,
        propiedad_id: uuid.UUID | None,
    ) -> bytes:
        pagina = self._reportes.danos_por_propiedad(
            actor, Paginacion(_MAX_FILAS), desde, hasta, propiedad_id
        )
        filas = [
            (
                f.propiedad_nombre,
                str(f.total),
                str(f.abiertos),
                str(f.en_reparacion),
                str(f.resueltos),
                str(f.urgentes),
            )
            for f in pagina.items
        ]
        textos = _TEXTOS[actor.idioma]
        return self._generar(textos, textos.danos, pagina, filas, desde, hasta)

    def _generar(
        self,
        textos: TextosPdf,
        reporte: TextosReporte,
        pagina: Pagina[Any],
        filas: Sequence[Sequence[str]],
        desde: date | None,
        hasta: date | None,
    ) -> bytes:
        generado = self._reloj.ahora().strftime("%Y-%m-%d %H:%M UTC")
        periodo = f"{desde or textos.todo} - {hasta or textos.todo}"
        subtitulo = (
            f"{textos.generado}: {generado} | {textos.periodo}: {periodo} | "
            f"{textos.mostrando}: {len(filas)}/{pagina.total}"
        )
        return generar_pdf_tabla(reporte.titulo, subtitulo, reporte.columnas, filas)
