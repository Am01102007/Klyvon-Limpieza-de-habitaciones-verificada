import random
from collections.abc import Callable, Iterator
from typing import Annotated

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.almacen_fotos import AlmacenFotos
from app.core.config import Settings
from app.core.database import Transaccion
from app.core.exceptions import NoAutenticado, SinPermiso
from app.core.paginacion import Paginacion
from app.core.reloj import Reloj
from app.core.seguridad import EmisorTokens
from app.models import Usuario
from app.models.enums import Rol
from app.repositories.asignaciones import AsignacionRepository
from app.repositories.danos import DanoRepository
from app.repositories.empresas import EmpresaRepository
from app.repositories.limpiezas import LimpiezaRepository
from app.repositories.propiedades import PropiedadRepository
from app.repositories.reportes import ReporteRepository
from app.repositories.salud import SaludRepository
from app.repositories.usuarios import RefreshTokenRepository, UsuarioRepository
from app.services.asignaciones import AsignacionService
from app.services.auth import AuthService
from app.services.danos import DanoService
from app.services.empresa import EmpresaService
from app.services.limpiezas import LimpiezaService
from app.services.propiedades import PropiedadService
from app.services.reportes import ReporteService
from app.services.reportes_pdf import ReportePdfService
from app.services.revisiones import RevisionService
from app.services.salud import SaludService
from app.services.usuarios import UsuarioService

_bearer = HTTPBearer(auto_error=False)


def obtener_sesion(request: Request) -> Iterator[Session]:
    with request.app.state.fabrica_sesiones() as sesion:
        yield sesion


SesionDep = Annotated[Session, Depends(obtener_sesion)]


def obtener_transaccion(sesion: SesionDep) -> Transaccion:
    return Transaccion(sesion)


TransaccionDep = Annotated[Transaccion, Depends(obtener_transaccion)]


def obtener_ajustes(request: Request) -> Settings:
    ajustes: Settings = request.app.state.ajustes
    return ajustes


AjustesDep = Annotated[Settings, Depends(obtener_ajustes)]


def obtener_reloj(request: Request) -> Reloj:
    reloj: Reloj = request.app.state.reloj
    return reloj


RelojDep = Annotated[Reloj, Depends(obtener_reloj)]


def obtener_emisor(request: Request) -> EmisorTokens:
    emisor: EmisorTokens = request.app.state.emisor
    return emisor


EmisorDep = Annotated[EmisorTokens, Depends(obtener_emisor)]


def obtener_almacen(request: Request) -> AlmacenFotos:
    almacen: AlmacenFotos = request.app.state.almacen
    return almacen


AlmacenDep = Annotated[AlmacenFotos, Depends(obtener_almacen)]


def obtener_azar(request: Request) -> random.Random:
    azar: random.Random = request.app.state.azar
    return azar


def obtener_paginacion(
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
    desplazamiento: Annotated[int, Query(ge=0)] = 0,
) -> Paginacion:
    return Paginacion(limite, desplazamiento)


PaginacionDep = Annotated[Paginacion, Depends(obtener_paginacion)]


def obtener_actor(
    sesion: SesionDep,
    tx: TransaccionDep,
    emisor: EmisorDep,
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Usuario:
    """La empresa sale siempre del token, nunca del cliente; RLS queda fijado aquí."""
    if credenciales is None:
        raise NoAutenticado
    datos = emisor.leer_access(credenciales.credentials)
    tx.fijar_empresa(datos.empresa_id)
    actor = UsuarioRepository(sesion, datos.empresa_id).obtener(datos.usuario_id)
    if actor is None or not actor.activo:
        raise NoAutenticado
    return actor


ActorDep = Annotated[Usuario, Depends(obtener_actor)]


def _requerir_roles(*roles: Rol) -> Callable[[Usuario], Usuario]:
    def verificar(actor: ActorDep) -> Usuario:
        if actor.rol not in roles:
            raise SinPermiso
        return actor

    return verificar


AdminDep = Annotated[Usuario, Depends(_requerir_roles(Rol.ADMIN))]
GestorDep = Annotated[Usuario, Depends(_requerir_roles(Rol.ADMIN, Rol.SUPERVISOR))]
EmpleadoDep = Annotated[Usuario, Depends(_requerir_roles(Rol.EMPLEADO))]


def obtener_salud_service(sesion: SesionDep) -> SaludService:
    return SaludService(SaludRepository(sesion))


SaludServiceDep = Annotated[SaludService, Depends(obtener_salud_service)]


def obtener_auth_service(
    sesion: SesionDep,
    tx: TransaccionDep,
    emisor: EmisorDep,
    reloj: RelojDep,
    ajustes: AjustesDep,
) -> AuthService:
    return AuthService(
        tx,
        EmpresaRepository(sesion),
        lambda empresa_id: UsuarioRepository(sesion, empresa_id),
        lambda empresa_id: RefreshTokenRepository(sesion, empresa_id),
        emisor,
        reloj,
        ajustes.refresh_horas,
    )


AuthServiceDep = Annotated[AuthService, Depends(obtener_auth_service)]


def obtener_usuario_service(
    sesion: SesionDep, tx: TransaccionDep, actor: ActorDep, reloj: RelojDep
) -> UsuarioService:
    return UsuarioService(
        tx,
        UsuarioRepository(sesion, actor.empresa_id),
        RefreshTokenRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
        EmpresaRepository(sesion),
        reloj,
    )


UsuarioServiceDep = Annotated[UsuarioService, Depends(obtener_usuario_service)]


def obtener_empresa_service(sesion: SesionDep, tx: TransaccionDep) -> EmpresaService:
    return EmpresaService(tx, EmpresaRepository(sesion))


EmpresaServiceDep = Annotated[EmpresaService, Depends(obtener_empresa_service)]


def obtener_propiedad_service(
    sesion: SesionDep, tx: TransaccionDep, actor: ActorDep
) -> PropiedadService:
    return PropiedadService(
        tx,
        PropiedadRepository(sesion, actor.empresa_id),
        UsuarioRepository(sesion, actor.empresa_id),
    )


PropiedadServiceDep = Annotated[PropiedadService, Depends(obtener_propiedad_service)]


def obtener_asignacion_service(
    sesion: SesionDep, tx: TransaccionDep, actor: ActorDep, reloj: RelojDep
) -> AsignacionService:
    return AsignacionService(
        tx,
        AsignacionRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
        UsuarioRepository(sesion, actor.empresa_id),
        reloj,
    )


AsignacionServiceDep = Annotated[AsignacionService, Depends(obtener_asignacion_service)]


def obtener_limpieza_service(
    sesion: SesionDep,
    tx: TransaccionDep,
    actor: ActorDep,
    almacen: AlmacenDep,
    reloj: RelojDep,
    azar: Annotated[random.Random, Depends(obtener_azar)],
) -> LimpiezaService:
    return LimpiezaService(
        tx,
        LimpiezaRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
        UsuarioRepository(sesion, actor.empresa_id),
        EmpresaRepository(sesion),
        almacen,
        reloj,
        azar,
    )


LimpiezaServiceDep = Annotated[LimpiezaService, Depends(obtener_limpieza_service)]


def obtener_revision_service(
    sesion: SesionDep, tx: TransaccionDep, actor: ActorDep, reloj: RelojDep
) -> RevisionService:
    return RevisionService(
        tx,
        LimpiezaRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
        reloj,
    )


RevisionServiceDep = Annotated[RevisionService, Depends(obtener_revision_service)]


def obtener_dano_service(
    sesion: SesionDep, tx: TransaccionDep, actor: ActorDep, almacen: AlmacenDep, reloj: RelojDep
) -> DanoService:
    return DanoService(
        tx,
        DanoRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
        almacen,
        reloj,
    )


DanoServiceDep = Annotated[DanoService, Depends(obtener_dano_service)]


def obtener_reporte_service(sesion: SesionDep, actor: ActorDep) -> ReporteService:
    return ReporteService(
        ReporteRepository(sesion, actor.empresa_id),
        PropiedadRepository(sesion, actor.empresa_id),
    )


ReporteServiceDep = Annotated[ReporteService, Depends(obtener_reporte_service)]


def obtener_reporte_pdf_service(servicio: ReporteServiceDep, reloj: RelojDep) -> ReportePdfService:
    return ReportePdfService(servicio, reloj)


ReportePdfServiceDep = Annotated[ReportePdfService, Depends(obtener_reporte_pdf_service)]
