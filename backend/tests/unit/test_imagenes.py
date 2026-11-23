import os
from io import BytesIO

import pytest
from PIL import Image

from app.core.exceptions import ArchivoDemasiadoGrande, EntradaInvalida
from app.core.imagenes import MAX_BYTES_SUBIDA, procesar_foto

_EXIF_ORIENTACION = 0x0112
_EXIF_GPS = 0x8825


def _jpeg_con_exif(lado: int = 2400) -> bytes:
    # Ruido para que la foto no se comprima sola: obliga a reducir calidad y tamaño.
    imagen = Image.frombytes("RGB", (lado, lado), os.urandom(lado * lado * 3))
    exif = Image.Exif()
    exif[_EXIF_ORIENTACION] = 1
    exif[0x010F] = "Fabricante del telefono"
    salida = BytesIO()
    imagen.save(salida, format="JPEG", quality=95, exif=exif)
    return salida.getvalue()


def test_cp23_la_foto_queda_bajo_500_kb_y_en_jpeg() -> None:
    resultado = procesar_foto(_jpeg_con_exif())

    assert len(resultado) < 500 * 1024
    assert Image.open(BytesIO(resultado)).format == "JPEG"


def test_la_foto_recodificada_no_conserva_exif() -> None:
    resultado = procesar_foto(_jpeg_con_exif(400))

    exif = Image.open(BytesIO(resultado)).getexif()
    assert 0x010F not in exif
    assert _EXIF_GPS not in exif


def test_rechaza_archivos_que_no_son_imagen_aunque_digan_jpg() -> None:
    with pytest.raises(EntradaInvalida):
        procesar_foto(b"<?php system($_GET['c']); ?>")


def test_rechaza_formatos_no_permitidos() -> None:
    salida = BytesIO()
    Image.new("RGB", (10, 10)).save(salida, format="GIF")

    with pytest.raises(EntradaInvalida):
        procesar_foto(salida.getvalue())


def test_rechaza_archivos_sobre_el_limite() -> None:
    with pytest.raises(ArchivoDemasiadoGrande):
        procesar_foto(b"0" * (MAX_BYTES_SUBIDA + 1))
