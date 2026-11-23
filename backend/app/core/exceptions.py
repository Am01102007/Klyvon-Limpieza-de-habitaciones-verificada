class ErrorDominio(Exception):
    """Error de negocio. `codigo` es estable para que el frontend lo traduzca."""

    codigo = "error_dominio"

    def __init__(self, codigo: str | None = None) -> None:
        super().__init__(codigo or self.codigo)
        if codigo is not None:
            self.codigo = codigo


class ServicioNoDisponible(ErrorDominio):
    codigo = "servicio_no_disponible"


class NoAutenticado(ErrorDominio):
    codigo = "no_autenticado"


class CuentaBloqueada(ErrorDominio):
    codigo = "cuenta_bloqueada"


class SinPermiso(ErrorDominio):
    codigo = "sin_permiso"


class NoEncontrado(ErrorDominio):
    codigo = "no_encontrado"


class Conflicto(ErrorDominio):
    codigo = "conflicto"


class EntradaInvalida(ErrorDominio):
    codigo = "entrada_invalida"


class ArchivoDemasiadoGrande(ErrorDominio):
    codigo = "archivo_demasiado_grande"
