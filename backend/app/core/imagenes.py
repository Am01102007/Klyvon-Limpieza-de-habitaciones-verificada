from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import ArchivoDemasiadoGrande, EntradaInvalida

MAX_BYTES_SUBIDA = 10 * 1024 * 1024
_FORMATOS_PERMITIDOS = ("JPEG", "PNG", "WEBP")
_MAX_PIXELES = 40_000_000
_LADO_MAX = 1600
_BYTES_OBJETIVO = 500 * 1024
_CALIDADES = (85, 75, 65, 55, 45)
_LADO_MIN = 800


def procesar_foto(contenido: bytes) -> bytes:
    """Valida por contenido y re-codifica a JPEG; lo re-codificado no conserva el EXIF."""
    if len(contenido) > MAX_BYTES_SUBIDA:
        raise ArchivoDemasiadoGrande
    imagen = _abrir(contenido)
    lado = _LADO_MAX
    while True:
        for calidad in _CALIDADES:
            resultado = _codificar(imagen, lado, calidad)
            if len(resultado) < _BYTES_OBJETIVO:
                return resultado
        if lado <= _LADO_MIN:
            raise ArchivoDemasiadoGrande
        lado = max(lado // 2, _LADO_MIN)


def _abrir(contenido: bytes) -> Image.Image:
    try:
        imagen = Image.open(BytesIO(contenido), formats=_FORMATOS_PERMITIDOS)
        ancho, alto = imagen.size
        if ancho * alto > _MAX_PIXELES:
            raise EntradaInvalida("foto_invalida")
        imagen.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise EntradaInvalida("foto_invalida") from error
    return ImageOps.exif_transpose(imagen).convert("RGB")


def _codificar(imagen: Image.Image, lado: int, calidad: int) -> bytes:
    copia = imagen.copy()
    copia.thumbnail((lado, lado))
    salida = BytesIO()
    copia.save(salida, format="JPEG", quality=calidad, optimize=True)
    return salida.getvalue()
