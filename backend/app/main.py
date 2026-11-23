import random
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    asignaciones,
    auth,
    danos,
    empresa,
    fotos,
    limpiezas,
    propiedades,
    reportes,
    revisiones,
    salud,
    usuarios,
)
from app.api.errores import registrar_manejadores
from app.api.limites import limitador
from app.api.seguridad_http import registrar_seguridad_http
from app.core.almacen_fotos import AlmacenLocal
from app.core.config import Settings, get_settings
from app.core.database import crear_engine, crear_fabrica_sesiones
from app.core.reloj import RelojSistema
from app.core.seguridad import EmisorTokens
from app.tareas import crear_programador


def create_app(settings: Settings | None = None) -> FastAPI:
    ajustes = settings or get_settings()
    produccion = ajustes.entorno == "produccion"
    engine = crear_engine(ajustes.database_url)
    fabrica = crear_fabrica_sesiones(engine)
    reloj = RelojSistema()
    almacen = AlmacenLocal(
        ajustes.fotos_dir, ajustes.fotos_firma_secreto, ajustes.foto_url_segundos
    )
    programador = crear_programador(fabrica, almacen, reloj)

    @asynccontextmanager
    async def ciclo_de_vida(_: FastAPI) -> AsyncIterator[None]:
        programador.start()
        yield
        programador.shutdown(wait=False)
        engine.dispose()

    app = FastAPI(
        title="API de limpieza de habitaciones",
        lifespan=ciclo_de_vida,
        docs_url=None if produccion else "/docs",
        redoc_url=None,
        openapi_url=None if produccion else "/openapi.json",
    )
    app.state.ajustes = ajustes
    app.state.fabrica_sesiones = fabrica
    app.state.reloj = reloj
    app.state.almacen = almacen
    app.state.azar = random.Random()  # noqa: S311  # la muestra no es un uso criptográfico
    app.state.emisor = EmisorTokens(ajustes.jwt_secreto, ajustes.access_minutos)
    app.state.limiter = limitador

    registrar_manejadores(app)
    registrar_seguridad_http(app, produccion)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ajustes.cors_origenes,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    for modulo in (
        salud,
        auth,
        empresa,
        usuarios,
        propiedades,
        asignaciones,
        limpiezas,
        revisiones,
        danos,
        reportes,
        fotos,
    ):
        app.include_router(modulo.router)
    return app
