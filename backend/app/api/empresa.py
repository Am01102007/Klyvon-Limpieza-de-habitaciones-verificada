from fastapi import APIRouter

from app.api.dependencias import AdminDep, EmpresaServiceDep
from app.api.schemas import EmpresaCambios, EmpresaSalida
from app.services.empresa import CambiosEmpresa

router = APIRouter(prefix="/empresa", tags=["empresa"])


@router.get("")
def consultar_empresa(actor: AdminDep, servicio: EmpresaServiceDep) -> EmpresaSalida:
    return EmpresaSalida.model_validate(servicio.obtener(actor))


@router.patch("")
def configurar_empresa(
    datos: EmpresaCambios, actor: AdminDep, servicio: EmpresaServiceDep
) -> EmpresaSalida:
    """RF-16: idioma, regla de revisión y días de retención de fotos."""
    empresa = servicio.configurar(actor, CambiosEmpresa(**datos.model_dump(exclude_unset=True)))
    return EmpresaSalida.model_validate(empresa)
