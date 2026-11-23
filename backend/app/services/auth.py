import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.database import Transaccion
from app.core.exceptions import CuentaBloqueada, NoAutenticado
from app.core.reloj import Reloj
from app.core.seguridad import (
    EmisorTokens,
    empresa_de_refresh,
    generar_refresh,
    hash_refresh,
    simular_verificacion,
    verificar_clave,
)
from app.models import RefreshToken, Usuario
from app.repositories.empresas import EmpresaRepository
from app.repositories.usuarios import RefreshTokenRepository, UsuarioRepository

MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15
_CREDENCIALES_INVALIDAS = "credenciales_invalidas"


@dataclass(frozen=True)
class SesionEmitida:
    usuario: Usuario
    access_token: str
    refresh_token: str
    expira_en_seg: int


class AuthService:
    def __init__(
        self,
        tx: Transaccion,
        empresas: EmpresaRepository,
        repos_usuario: Callable[[uuid.UUID], UsuarioRepository],
        repos_token: Callable[[uuid.UUID], RefreshTokenRepository],
        emisor: EmisorTokens,
        reloj: Reloj,
        horas_refresh: int,
    ) -> None:
        self._tx = tx
        self._empresas = empresas
        self._repos_usuario = repos_usuario
        self._repos_token = repos_token
        self._emisor = emisor
        self._reloj = reloj
        self._vigencia_refresh = timedelta(hours=horas_refresh)

    def iniciar_sesion(self, codigo_empresa: str, nombre_usuario: str, clave: str) -> SesionEmitida:
        """RF-01, CP-01 y CP-02."""
        empresa_id = self._empresas.id_por_codigo(codigo_empresa)
        if empresa_id is None:
            simular_verificacion(clave)
            raise NoAutenticado(_CREDENCIALES_INVALIDAS)
        self._tx.fijar_empresa(empresa_id)

        usuario = self._repos_usuario(empresa_id).por_nombre_para_actualizar(nombre_usuario)
        if usuario is None or not usuario.activo:
            simular_verificacion(clave)
            raise NoAutenticado(_CREDENCIALES_INVALIDAS)

        ahora = self._reloj.ahora()
        clave_correcta = verificar_clave(usuario.hash_clave, clave)
        if usuario.esta_bloqueado(ahora):
            # Solo quien conoce la clave sabe que la cuenta está bloqueada.
            raise CuentaBloqueada if clave_correcta else NoAutenticado(_CREDENCIALES_INVALIDAS)
        if not clave_correcta:
            self._registrar_intento_fallido(usuario, ahora)
            self._tx.confirmar()
            raise NoAutenticado(_CREDENCIALES_INVALIDAS)

        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        sesion = self._emitir(usuario, ahora)
        self._tx.confirmar()
        return sesion

    def renovar(self, token: str | None) -> SesionEmitida:
        """Rota el refresh token; reutilizar uno ya rotado revoca toda la sesión."""
        if token is None:
            raise NoAutenticado
        empresa_id = empresa_de_refresh(token)
        self._tx.fijar_empresa(empresa_id)
        tokens = self._repos_token(empresa_id)
        registro = tokens.por_hash_para_actualizar(hash_refresh(token))
        if registro is None:
            raise NoAutenticado

        ahora = self._reloj.ahora()
        if registro.revocado_en is not None:
            tokens.revocar_todos(registro.usuario_id, ahora)
            self._tx.confirmar()
            raise NoAutenticado
        usuario = self._repos_usuario(empresa_id).obtener(registro.usuario_id)
        if registro.expira_en <= ahora or usuario is None or not usuario.activo:
            raise NoAutenticado

        registro.revocado_en = ahora
        sesion = self._emitir(usuario, ahora)
        self._tx.confirmar()
        return sesion

    def cerrar_sesion(self, token: str | None) -> None:
        if token is None:
            return
        try:
            empresa_id = empresa_de_refresh(token)
        except NoAutenticado:
            return
        self._tx.fijar_empresa(empresa_id)
        registro = self._repos_token(empresa_id).por_hash_para_actualizar(hash_refresh(token))
        if registro is not None and registro.revocado_en is None:
            registro.revocado_en = self._reloj.ahora()
            self._tx.confirmar()

    def _registrar_intento_fallido(self, usuario: Usuario, ahora: datetime) -> None:
        if usuario.bloqueado_hasta is not None:
            usuario.intentos_fallidos = 0
            usuario.bloqueado_hasta = None
        usuario.intentos_fallidos += 1
        if usuario.intentos_fallidos >= MAX_INTENTOS:
            usuario.bloqueado_hasta = ahora + timedelta(minutes=MINUTOS_BLOQUEO)

    def _emitir(self, usuario: Usuario, ahora: datetime) -> SesionEmitida:
        refresh = generar_refresh(usuario.empresa_id)
        self._repos_token(usuario.empresa_id).agregar(
            RefreshToken(
                empresa_id=usuario.empresa_id,
                usuario_id=usuario.id,
                hash_token=hash_refresh(refresh),
                expira_en=ahora + self._vigencia_refresh,
            )
        )
        return SesionEmitida(
            usuario=usuario,
            access_token=self._emisor.crear_access(usuario.id, usuario.empresa_id, ahora),
            refresh_token=refresh,
            expira_en_seg=self._emisor.segundos_vigencia,
        )
