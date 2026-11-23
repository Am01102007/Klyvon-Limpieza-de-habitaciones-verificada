import uuid
from dataclasses import dataclass

from app.core.database import Transaccion
from app.core.exceptions import EntradaInvalida, NoEncontrado
from app.core.paginacion import Pagina, Paginacion
from app.core.reloj import Reloj
from app.core.seguridad import generar_hash_clave
from app.models import CLASE_POR_ROL, Usuario
from app.models.enums import Idioma, Rol, TipoClave
from app.repositories.empresas import EmpresaRepository
from app.repositories.propiedades import PropiedadRepository
from app.repositories.usuarios import RefreshTokenRepository, UsuarioRepository


@dataclass(frozen=True)
class DatosNuevoUsuario:
    nombre_usuario: str
    clave: str
    tipo_clave: TipoClave
    rol: Rol
    idioma: Idioma | None = None


class UsuarioService:
    def __init__(
        self,
        tx: Transaccion,
        usuarios: UsuarioRepository,
        tokens: RefreshTokenRepository,
        propiedades: PropiedadRepository,
        empresas: EmpresaRepository,
        reloj: Reloj,
    ) -> None:
        self._tx = tx
        self._usuarios = usuarios
        self._tokens = tokens
        self._propiedades = propiedades
        self._empresas = empresas
        self._reloj = reloj

    def listar(self, actor: Usuario, paginacion: Paginacion, rol: Rol | None) -> Pagina[Usuario]:
        """El supervisor solo ve empleados, a quienes puede asignar habitaciones."""
        if actor.rol == Rol.SUPERVISOR:
            rol = Rol.EMPLEADO
        return self._usuarios.listar(paginacion, rol)

    def obtener(self, actor: Usuario, usuario_id: uuid.UUID) -> Usuario:
        usuario = self._usuarios.obtener(usuario_id)
        if usuario is None or (actor.rol == Rol.SUPERVISOR and usuario.rol != Rol.EMPLEADO):
            raise NoEncontrado
        return usuario

    def crear(self, actor: Usuario, datos: DatosNuevoUsuario) -> Usuario:
        """RF-02, CP-03."""
        _exigir_tipo_clave_valido(datos.rol, datos.tipo_clave)
        empresa = self._empresas.obtener(actor.empresa_id)
        if empresa is None:
            raise NoEncontrado
        usuario = CLASE_POR_ROL[datos.rol](
            empresa_id=actor.empresa_id,
            nombre_usuario=datos.nombre_usuario,
            hash_clave=generar_hash_clave(datos.clave),
            tipo_clave=datos.tipo_clave,
            idioma=datos.idioma or empresa.idioma,
        )
        self._usuarios.agregar(usuario, "nombre_usuario_duplicado")
        self._tx.confirmar()
        return usuario

    def actualizar(
        self,
        actor: Usuario,
        usuario_id: uuid.UUID,
        nombre_usuario: str | None,
        idioma: Idioma | None,
        rol: Rol | None,
        activo: bool | None,
    ) -> Usuario:
        """RF-02. Desactivar no borra el historial (HU-02)."""
        usuario = self.obtener(actor, usuario_id)
        cambia_acceso = (rol is not None and rol != usuario.rol) or activo is False
        if usuario.id == actor.id and cambia_acceso:
            raise EntradaInvalida("no_puede_cambiar_su_propio_acceso")
        if nombre_usuario is not None:
            usuario.nombre_usuario = nombre_usuario
        if idioma is not None:
            usuario.idioma = idioma
        if activo is not None:
            usuario.activo = activo
        self._usuarios.guardar("nombre_usuario_duplicado")
        if activo is False:
            self._tokens.revocar_todos(usuario.id, self._reloj.ahora())
        if rol is not None and rol != usuario.rol:
            usuario = self._cambiar_rol(usuario, rol)
        self._tx.confirmar()
        return usuario

    def restablecer_clave(
        self, actor: Usuario, usuario_id: uuid.UUID, clave: str, tipo_clave: TipoClave
    ) -> None:
        """RF-03: también desbloquea la cuenta y cierra sus sesiones."""
        usuario = self.obtener(actor, usuario_id)
        if actor.rol == Rol.SUPERVISOR:
            propiedades = self._propiedades.ids_de_supervisor(actor.id)
            if not self._usuarios.trabaja_en_propiedades(usuario.id, propiedades):
                raise NoEncontrado
        _exigir_tipo_clave_valido(usuario.rol, tipo_clave)
        usuario.hash_clave = generar_hash_clave(clave)
        usuario.tipo_clave = tipo_clave
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        self._usuarios.guardar()
        self._tokens.revocar_todos(usuario.id, self._reloj.ahora())
        self._tx.confirmar()

    def cambiar_idioma_propio(self, actor: Usuario, idioma: Idioma) -> Usuario:
        actor.idioma = idioma
        self._tx.confirmar()
        return actor

    def _cambiar_rol(self, usuario: Usuario, rol: Rol) -> Usuario:
        _exigir_tipo_clave_valido(rol, usuario.tipo_clave)
        if usuario.rol == Rol.SUPERVISOR:
            self._usuarios.quitar_de_propiedades(usuario.id)
        return self._usuarios.cambiar_rol(usuario, rol)


def _exigir_tipo_clave_valido(rol: Rol, tipo_clave: TipoClave) -> None:
    if tipo_clave == TipoClave.PIN and rol != Rol.EMPLEADO:
        raise EntradaInvalida("pin_solo_empleados")
