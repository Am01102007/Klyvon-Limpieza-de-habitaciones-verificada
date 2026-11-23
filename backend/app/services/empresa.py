from dataclasses import dataclass

from app.core.database import Transaccion
from app.core.exceptions import NoEncontrado
from app.models import Empresa, Usuario
from app.models.enums import Idioma, ReglaRevision
from app.repositories.empresas import EmpresaRepository


@dataclass(frozen=True)
class CambiosEmpresa:
    nombre: str | None = None
    idioma: Idioma | None = None
    regla_revision: ReglaRevision | None = None
    muestra_n: int | None = None
    retencion_fotos_dias: int | None = None


class EmpresaService:
    def __init__(self, tx: Transaccion, empresas: EmpresaRepository) -> None:
        self._tx = tx
        self._empresas = empresas

    def obtener(self, actor: Usuario) -> Empresa:
        empresa = self._empresas.obtener(actor.empresa_id)
        if empresa is None:
            raise NoEncontrado
        return empresa

    def configurar(self, actor: Usuario, cambios: CambiosEmpresa) -> Empresa:
        """RF-16, HU-13 y HU-16."""
        empresa = self.obtener(actor)
        if cambios.nombre is not None:
            empresa.nombre = cambios.nombre
        if cambios.idioma is not None:
            empresa.idioma = cambios.idioma
        if cambios.regla_revision is not None:
            empresa.regla_revision = cambios.regla_revision
        if cambios.muestra_n is not None:
            empresa.muestra_n = cambios.muestra_n
        if cambios.retencion_fotos_dias is not None:
            empresa.retencion_fotos_dias = cambios.retencion_fotos_dias
        self._tx.confirmar()
        return empresa
