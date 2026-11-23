from collections.abc import Sequence
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generar_pdf_tabla(
    titulo: str, subtitulo: str, columnas: Sequence[str], filas: Sequence[Sequence[str]]
) -> bytes:
    """Los textos se escapan: un nombre con marcado no puede alterar el documento."""
    estilos = getSampleStyleSheet()
    celda = estilos["BodyText"]
    tabla = Table(
        [
            [Paragraph(f"<b>{escape(columna)}</b>", celda) for columna in columnas],
            *[[Paragraph(escape(valor), celda) for valor in fila] for fila in filas],
        ],
        repeatRows=1,
    )
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    salida = BytesIO()
    SimpleDocTemplate(salida, pagesize=A4, title=titulo).build(
        [
            Paragraph(escape(titulo), estilos["Title"]),
            Paragraph(escape(subtitulo), estilos["Normal"]),
            Spacer(1, 12),
            tabla,
        ]
    )
    return salida.getvalue()
