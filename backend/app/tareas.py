import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session, sessionmaker

from app.core.almacen_fotos import AlmacenFotos
from app.core.database import Transaccion
from app.core.reloj import Reloj
from app.repositories.danos import FotoVencidaRepository
from app.repositories.empresas import EmpresaRepository
from app.services.borrado_fotos import BorradoFotosService

logger = logging.getLogger(__name__)

_HORA_UTC_BORRADO = 3


def borrar_fotos_vencidas(
    fabrica: sessionmaker[Session], almacen: AlmacenFotos, reloj: Reloj
) -> int:
    """CU-15: recorre cada empresa con su propio contexto de RLS."""
    with fabrica() as sesion:
        empresas_ids = EmpresaRepository(sesion).todos_los_ids()
    total = 0
    for empresa_id in empresas_ids:
        with fabrica() as sesion:
            tx = Transaccion(sesion)
            tx.fijar_empresa(empresa_id)
            empresa = EmpresaRepository(sesion).obtener(empresa_id)
            if empresa is None:
                continue
            servicio = BorradoFotosService(
                tx, FotoVencidaRepository(sesion, empresa_id), almacen, reloj
            )
            total += servicio.borrar_vencidas(empresa)
    logger.info("Fotos vencidas borradas: %s", total)
    return total


def crear_programador(
    fabrica: sessionmaker[Session], almacen: AlmacenFotos, reloj: Reloj
) -> BackgroundScheduler:
    programador = BackgroundScheduler(timezone="UTC")
    programador.add_job(
        borrar_fotos_vencidas,
        "cron",
        hour=_HORA_UTC_BORRADO,
        args=[fabrica, almacen, reloj],
        id="borrado_fotos",
    )
    return programador
