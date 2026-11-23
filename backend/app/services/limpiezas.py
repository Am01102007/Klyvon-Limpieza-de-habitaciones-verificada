import random
import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.core.almacen_fotos import AlmacenFotos
from app.core.database import Transaccion
from app.core.exceptions import Conflicto, NoEncontrado
from app.core.imagenes import procesar_foto
from app.core.paginacion import Pagina, Paginacion
from app.core.reloj import Reloj
from app.models import Dano, Foto, Limpieza, Pausa, Revision, Usuario
from app.models.enums import (
    CategoriaDano,
    EstadoRevision,
    EstadoTrabajo,
    GravedadDano,
    MomentoFoto,
    MotivoPausa,
    Rol,
)
from app.repositories.empresas import EmpresaRepository
from app.repositories.limpiezas import ContextoLimpieza, LimpiezaRepository
from app.repositories.propiedades import PropiedadRepository
from app.repositories.usuarios import UsuarioRepository
from app.services.alcance import exigir_propiedad_visible, propiedades_visibles
from app.services.reglas_revision import DatosRevision, crear_estrategia


@dataclass(frozen=True)
class FotoVista:
    id: uuid.UUID
    limpieza_id: uuid.UUID
    dano_id: uuid.UUID | None
    momento: MomentoFoto
    url: str
    tomada_en: datetime
    tamano_kb: int


@dataclass(frozen=True)
class DetalleLimpieza:
    limpieza: Limpieza
    habitacion_nombre: str
    fecha: date
    fotos: Sequence[FotoVista]
    pausas: Sequence[Pausa]
    danos: Sequence[Dano]
    revision: Revision | None


def vista_de_foto(foto: Foto, almacen: AlmacenFotos, ahora: datetime) -> FotoVista:
    return FotoVista(
        id=foto.id,
        limpieza_id=foto.limpieza_id,
        dano_id=foto.dano_id,
        momento=foto.momento,
        url=almacen.url_firmada(foto.url, ahora),
        tomada_en=foto.tomada_en,
        tamano_kb=foto.tamano_kb,
    )


def calcular_duracion_neta(inicio: datetime, fin: datetime, pausas: Sequence[Pausa]) -> int:
    """RF-09, CP-11: duración neta = fin - inicio - pausas, solo con hora del servidor."""
    pausado = 0.0
    for pausa in pausas:
        fin_pausa = min(pausa.fin or fin, fin)
        pausado += max((fin_pausa - pausa.inicio).total_seconds(), 0)
    return int((fin - inicio).total_seconds() - pausado)


class LimpiezaService:
    def __init__(
        self,
        tx: Transaccion,
        limpiezas: LimpiezaRepository,
        propiedades: PropiedadRepository,
        usuarios: UsuarioRepository,
        empresas: EmpresaRepository,
        almacen: AlmacenFotos,
        reloj: Reloj,
        azar: random.Random,
    ) -> None:
        self._tx = tx
        self._limpiezas = limpiezas
        self._propiedades = propiedades
        self._usuarios = usuarios
        self._empresas = empresas
        self._almacen = almacen
        self._reloj = reloj
        self._azar = azar

    def listar(
        self,
        actor: Usuario,
        paginacion: Paginacion,
        estado_revision: EstadoRevision | None,
        propiedad_id: uuid.UUID | None,
        empleado_id: uuid.UUID | None,
        desde: date | None,
        hasta: date | None,
    ) -> Pagina[Any]:
        return self._limpiezas.listar(
            paginacion,
            propiedades_visibles(actor, self._propiedades),
            estado_revision,
            propiedad_id,
            empleado_id,
            desde,
            hasta,
        )

    def detalle(self, actor: Usuario, limpieza_id: uuid.UUID) -> DetalleLimpieza:
        contexto = self._limpiezas.obtener_contexto(limpieza_id)
        if contexto is None:
            raise NoEncontrado
        self._exigir_lectura(actor, contexto)
        ahora = self._reloj.ahora()
        return DetalleLimpieza(
            limpieza=contexto.limpieza,
            habitacion_nombre=contexto.habitacion.nombre,
            fecha=contexto.fecha,
            fotos=[
                vista_de_foto(foto, self._almacen, ahora)
                for foto in self._limpiezas.fotos(limpieza_id)
            ],
            pausas=self._limpiezas.pausas(limpieza_id),
            danos=self._limpiezas.danos(limpieza_id),
            revision=self._limpiezas.revision_de(limpieza_id),
        )

    def iniciar(
        self, actor: Usuario, limpieza_id: uuid.UUID, contenido: bytes, foto_id: uuid.UUID | None
    ) -> Limpieza:
        """RF-07, CP-07: la primera foto de entrada arranca el cronómetro."""
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        limpieza = contexto.limpieza
        if limpieza.estado_trabajo != EstadoTrabajo.PENDIENTE:
            if self._foto_ya_registrada(foto_id, limpieza_id) is not None:
                return limpieza
            raise Conflicto("limpieza_ya_iniciada")
        self._exigir_que_no_sea_futura(contexto)
        if self._limpiezas.tiene_otra_abierta(actor.id):
            raise Conflicto("otra_limpieza_abierta")

        with self._guardando_foto(contexto, MomentoFoto.ENTRADA, contenido, foto_id, None) as foto:
            limpieza.inicio = foto.tomada_en
            limpieza.estado_trabajo = EstadoTrabajo.EN_CURSO
            self._limpiezas.guardar("otra_limpieza_abierta")
        return limpieza

    def agregar_foto(
        self,
        actor: Usuario,
        limpieza_id: uuid.UUID,
        momento: MomentoFoto,
        contenido: bytes,
        foto_id: uuid.UUID | None,
    ) -> FotoVista:
        """RF-07, RF-10 y CP-08."""
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        repetida = self._foto_ya_registrada(foto_id, limpieza_id)
        if repetida is not None:
            return vista_de_foto(repetida, self._almacen, self._reloj.ahora())
        self._exigir_en_curso(contexto.limpieza)
        if momento == MomentoFoto.SALIDA:
            self._exigir_fotos_de_entrada(contexto)
            if self._limpiezas.pausa_abierta(limpieza_id) is not None:
                raise Conflicto("pausa_abierta")
        with self._guardando_foto(contexto, momento, contenido, foto_id, None) as foto:
            pass
        return vista_de_foto(foto, self._almacen, self._reloj.ahora())

    def pausar(
        self,
        actor: Usuario,
        limpieza_id: uuid.UUID,
        motivo: MotivoPausa,
        pausa_id: uuid.UUID | None,
    ) -> Pausa:
        """RF-09, HU-08."""
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        if pausa_id is not None:
            repetida = self._limpiezas.obtener_pausa(pausa_id)
            if repetida is not None and repetida.limpieza_id == limpieza_id:
                return repetida
        self._exigir_en_curso(contexto.limpieza)
        pausa = Pausa(
            id=pausa_id or uuid.uuid4(),
            empresa_id=actor.empresa_id,
            limpieza_id=limpieza_id,
            motivo=motivo,
            inicio=self._reloj.ahora(),
        )
        self._limpiezas.agregar(pausa, "pausa_abierta")
        self._tx.confirmar()
        return pausa

    def reanudar(self, actor: Usuario, limpieza_id: uuid.UUID) -> Pausa:
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        self._exigir_en_curso(contexto.limpieza)
        pausa = self._limpiezas.pausa_abierta(limpieza_id)
        if pausa is None:
            raise Conflicto("sin_pausa_abierta")
        pausa.fin = self._reloj.ahora()
        self._tx.confirmar()
        return pausa

    def reportar_dano(
        self,
        actor: Usuario,
        limpieza_id: uuid.UUID,
        categoria: CategoriaDano,
        gravedad: GravedadDano,
        nota: str | None,
        contenido: bytes,
        dano_id: uuid.UUID | None,
    ) -> Dano:
        """RF-08, CP-10: el daño siempre lleva foto, categoría y gravedad."""
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        if dano_id is not None:
            repetido = self._limpiezas.obtener_dano(dano_id)
            if repetido is not None and repetido.limpieza_id == limpieza_id:
                return repetido
        self._exigir_en_curso(contexto.limpieza)
        dano = Dano(
            id=dano_id or uuid.uuid4(),
            empresa_id=actor.empresa_id,
            limpieza_id=limpieza_id,
            categoria=categoria,
            gravedad=gravedad,
            nota=nota,
            creado_en=self._reloj.ahora(),
        )
        self._limpiezas.agregar(dano)
        with self._guardando_foto(contexto, MomentoFoto.DANO, contenido, None, dano.id):
            pass
        return dano

    def finalizar(self, actor: Usuario, limpieza_id: uuid.UUID) -> Limpieza:
        """RF-10, RF-11, CP-12 y CP-13: cierra, calcula y decide la revisión, todo o nada."""
        contexto = self._contexto_del_empleado(actor, limpieza_id)
        limpieza = contexto.limpieza
        if limpieza.estado_trabajo == EstadoTrabajo.ENVIADA:
            return limpieza
        self._exigir_en_curso(limpieza)
        if self._limpiezas.pausa_abierta(limpieza_id) is not None:
            raise Conflicto("pausa_abierta")
        self._exigir_fotos_de_entrada(contexto)
        minimo = contexto.habitacion.fotos_min_salida
        if self._limpiezas.contar_fotos(limpieza_id, MomentoFoto.SALIDA) < minimo:
            raise Conflicto("fotos_salida_insuficientes")
        fin = self._limpiezas.ultima_foto_salida(limpieza_id)
        if fin is None or limpieza.inicio is None:
            raise Conflicto("fotos_salida_insuficientes")

        duracion = calcular_duracion_neta(limpieza.inicio, fin, self._limpiezas.pausas(limpieza_id))
        limpieza.fin = fin
        limpieza.duracion_neta_seg = duracion
        limpieza.estado_trabajo = EstadoTrabajo.ENVIADA
        self._limpiezas.guardar()
        limpieza.requiere_revision = self._decidir_revision(actor, contexto)
        limpieza.estado_revision = (
            EstadoRevision.PENDIENTE if limpieza.requiere_revision else EstadoRevision.NO_REQUERIDA
        )
        self._tx.confirmar()
        return limpieza

    def _decidir_revision(self, actor: Usuario, contexto: ContextoLimpieza) -> bool:
        empresa = self._empresas.obtener(actor.empresa_id)
        if empresa is None or contexto.limpieza.duracion_neta_seg is None:
            raise NoEncontrado
        estrategia = crear_estrategia(empresa.regla_revision, empresa.muestra_n, self._azar)
        return estrategia.requiere_revision(
            DatosRevision(
                empleado_creado_en=actor.creado_en,
                ahora=self._reloj.ahora(),
                tiene_danos=bool(self._limpiezas.danos(contexto.limpieza.id)),
                duracion_neta_seg=contexto.limpieza.duracion_neta_seg,
                promedio_habitacion_seg=self._limpiezas.promedio_duracion_habitacion(
                    contexto.habitacion.id, contexto.limpieza.id
                ),
            )
        )

    @contextmanager
    def _guardando_foto(
        self,
        contexto: ContextoLimpieza,
        momento: MomentoFoto,
        contenido: bytes,
        foto_id: uuid.UUID | None,
        dano_id: uuid.UUID | None,
    ) -> Iterator[Foto]:
        """El archivo y la fila quedan juntos: si la transacción falla, se borra el archivo."""
        procesada = procesar_foto(contenido)
        limpieza = contexto.limpieza
        identificador = foto_id or uuid.uuid4()
        clave = (
            f"{limpieza.empresa_id}/{contexto.habitacion.propiedad_id}/"
            f"{limpieza.id}/{identificador}.jpg"
        )
        foto = Foto(
            id=identificador,
            empresa_id=limpieza.empresa_id,
            limpieza_id=limpieza.id,
            dano_id=dano_id,
            momento=momento,
            url=clave,
            tomada_en=self._reloj.ahora(),
            tamano_kb=max(len(procesada) // 1024, 1),
        )
        self._almacen.guardar(clave, procesada)
        try:
            yield foto
            self._limpiezas.agregar(foto)
            self._tx.confirmar()
        except Exception:
            self._almacen.eliminar(clave)
            raise

    def _contexto_del_empleado(self, actor: Usuario, limpieza_id: uuid.UUID) -> ContextoLimpieza:
        contexto = self._limpiezas.obtener_contexto(limpieza_id, para_actualizar=True)
        if contexto is None or contexto.limpieza.empleado_id != actor.id:
            raise NoEncontrado
        return contexto

    def _exigir_lectura(self, actor: Usuario, contexto: ContextoLimpieza) -> None:
        if actor.rol != Rol.EMPLEADO:
            exigir_propiedad_visible(actor, contexto.habitacion.propiedad_id, self._propiedades)
            return
        # El empleado solo ve lo suyo y de hoy, salvo trabajo que aún tenga abierto.
        limpieza = contexto.limpieza
        es_de_hoy = contexto.fecha == self._hoy(contexto)
        abierta = limpieza.estado_trabajo != EstadoTrabajo.ENVIADA
        if limpieza.empleado_id != actor.id or not (es_de_hoy or abierta):
            raise NoEncontrado

    def _exigir_que_no_sea_futura(self, contexto: ContextoLimpieza) -> None:
        if contexto.fecha > self._hoy(contexto):
            raise Conflicto("limpieza_no_es_de_hoy")

    def _exigir_fotos_de_entrada(self, contexto: ContextoLimpieza) -> None:
        minimo = contexto.habitacion.fotos_min_entrada
        if self._limpiezas.contar_fotos(contexto.limpieza.id, MomentoFoto.ENTRADA) < minimo:
            raise Conflicto("fotos_entrada_insuficientes")

    def _foto_ya_registrada(self, foto_id: uuid.UUID | None, limpieza_id: uuid.UUID) -> Foto | None:
        """RNF-03: un reintento sin conexión con el mismo id no crea duplicados."""
        if foto_id is None:
            return None
        foto = self._limpiezas.obtener_foto(foto_id)
        return foto if foto is not None and foto.limpieza_id == limpieza_id else None

    def _hoy(self, contexto: ContextoLimpieza) -> date:
        return self._reloj.ahora().astimezone(ZoneInfo(contexto.zona_horaria)).date()

    @staticmethod
    def _exigir_en_curso(limpieza: Limpieza) -> None:
        if limpieza.estado_trabajo != EstadoTrabajo.EN_CURSO:
            raise Conflicto("limpieza_no_esta_en_curso")
