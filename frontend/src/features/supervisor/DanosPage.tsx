import { CheckCircle2, Eye, RotateCcw, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type DanoResumen, type EstadoDano } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { InsigniaEstado, type TipoInsigniaEstado } from '@/components/InsigniaEstado';
import { Modal } from '@/components/Modal';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Paginador } from '@/components/Paginador';
import { Selector } from '@/components/Selector';
import { Vacio } from '@/components/Vacio';
import { formatearFechaHoraPropiedad } from '@/utils/fecha';

import {
  useCambiarEstadoDano,
  useDanos,
  useDetalleDano,
  usePropiedadesCatalogo,
  useUsuariosCatalogo,
} from './hooks';

const LIMITE = 50;

const INSIGNIA_ESTADO: Record<EstadoDano, TipoInsigniaEstado> = {
  abierto: 'dano_abierto',
  en_reparacion: 'dano_en_reparacion',
  resuelto: 'dano_resuelto',
};

export function DanosPage() {
  const { t } = useTranslation();
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoDano | ''>('');
  const [propiedadFiltro, setPropiedadFiltro] = useState('');
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [danoAbierto, setDanoAbierto] = useState<DanoResumen | null>(null);

  const danosQuery = useDanos({
    estado: estadoFiltro || undefined,
    propiedadId: propiedadFiltro || undefined,
    limite: LIMITE,
    desplazamiento,
  });
  const propiedades = usePropiedadesCatalogo().data?.items ?? [];
  const nombrePropiedad = new Map(propiedades.map((p) => [p.id, p.nombre]));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('danos.titulo')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('danos.subtitulo')}</p>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <Selector
          etiqueta={t('danos.filtrar_estado')}
          value={estadoFiltro}
          opcionVacia={t('danos.todos_estados')}
          opciones={(['abierto', 'en_reparacion', 'resuelto'] as const).map((e) => ({
            valor: e,
            texto: t(`danos.estados.${e}`),
          }))}
          onChange={(e) => {
            setEstadoFiltro(e.target.value as EstadoDano | '');
            setDesplazamiento(0);
          }}
        />
        <Selector
          etiqueta={t('danos.filtrar_propiedad')}
          value={propiedadFiltro}
          opcionVacia={t('revisiones.todas_propiedades')}
          opciones={propiedades.map((p) => ({ valor: p.id, texto: p.nombre }))}
          onChange={(e) => {
            setPropiedadFiltro(e.target.value);
            setDesplazamiento(0);
          }}
        />
      </section>

      {danosQuery.isPending ? (
        <Cargando />
      ) : danosQuery.isError ? (
        <ErrorPantalla
          error={danosQuery.error}
          alReintentar={() => {
            void danosQuery.refetch();
          }}
        />
      ) : danosQuery.data.items.length === 0 ? (
        <Vacio titulo={t('danos.vacio_titulo')} descripcion={t('danos.vacio_descripcion')} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {danosQuery.data.items.map((dano) => (
              <li
                key={dano.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {dano.habitacion_nombre} ·{' '}
                        {t(`limpieza.danos.categorias.${dano.categoria}`)}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {nombrePropiedad.get(dano.propiedad_id) ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <InsigniaEstado
                        estado={dano.gravedad === 'urgente' ? 'dano_urgente' : 'dano_leve'}
                      />
                      <InsigniaEstado estado={INSIGNIA_ESTADO[dano.estado]} />
                    </div>
                  </div>
                  {dano.nota && (
                    <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-300">
                      {dano.nota}
                    </p>
                  )}
                </div>
                <Boton
                  variante="secundario"
                  icono={<Eye className="h-4 w-4" />}
                  onClick={() => {
                    setDanoAbierto(dano);
                  }}
                >
                  {t('danos.ver_detalle')}
                </Boton>
              </li>
            ))}
          </ul>
          <Paginador
            desplazamiento={desplazamiento}
            limite={LIMITE}
            total={danosQuery.data.total}
            alCambiar={setDesplazamiento}
          />
        </>
      )}

      <Modal
        abierto={danoAbierto !== null}
        titulo={
          danoAbierto
            ? `${danoAbierto.habitacion_nombre} · ${t(`limpieza.danos.categorias.${danoAbierto.categoria}`)}`
            : ''
        }
        alCerrar={() => {
          setDanoAbierto(null);
        }}
      >
        {danoAbierto && <DetalleDano danoId={danoAbierto.id} />}
      </Modal>
    </div>
  );
}

function DetalleDano({ danoId }: { danoId: string }) {
  const { t, i18n } = useTranslation();
  const detalleQuery = useDetalleDano(danoId);
  const usuarios = useUsuariosCatalogo().data?.items ?? [];
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre_usuario]));
  const propiedades = usePropiedadesCatalogo().data?.items ?? [];
  const zonaPropiedad = new Map(propiedades.map((p) => [p.id, p.zona_horaria]));
  const cambiarEstado = useCambiarEstadoDano();
  const [error, setError] = useState<string | null>(null);

  if (detalleQuery.isPending) {
    return <Cargando />;
  }
  if (detalleQuery.isError) {
    return <ErrorPantalla error={detalleQuery.error} />;
  }

  const { dano, fotos, historial } = detalleQuery.data;
  const zona = zonaPropiedad.get(detalleQuery.data.propiedad_id) ?? 'UTC';
  const fecha = (iso: string) => formatearFechaHoraPropiedad(iso, zona, i18n.language);

  const cambiar = async (estado: EstadoDano) => {
    setError(null);
    try {
      await cambiarEstado.mutateAsync({ danoId: dano.id, estado });
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <div className="flex flex-wrap gap-1.5">
        <InsigniaEstado estado={dano.gravedad === 'urgente' ? 'dano_urgente' : 'dano_leve'} />
        <InsigniaEstado estado={INSIGNIA_ESTADO[dano.estado]} />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t('danos.reportado_en', { fecha: fecha(dano.creado_en) })}
      </p>
      {dano.nota && (
        <p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-200">
          {dano.nota}
        </p>
      )}

      {fotos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {fotos.map((foto, indice) => (
            <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
              <img
                src={foto.url}
                alt={t('danos.foto_n', { n: indice + 1 })}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('revisiones.sin_fotos')}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {dano.estado === 'abierto' && (
          <Boton
            variante="secundario"
            cargando={cambiarEstado.isPending}
            icono={<Wrench className="h-4 w-4" />}
            onClick={() => void cambiar('en_reparacion')}
          >
            {t('danos.marcar_reparacion')}
          </Boton>
        )}
        {dano.estado !== 'resuelto' ? (
          <Boton
            variante="primario"
            cargando={cambiarEstado.isPending}
            icono={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => void cambiar('resuelto')}
          >
            {t('danos.marcar_resuelto')}
          </Boton>
        ) : (
          <Boton
            variante="secundario"
            cargando={cambiarEstado.isPending}
            icono={<RotateCcw className="h-4 w-4" />}
            onClick={() => void cambiar('abierto')}
          >
            {t('danos.reabrir')}
          </Boton>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
          {t('danos.historial')}
        </h3>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('danos.sin_historial')}</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            {historial.map((cambio) => (
              <li key={cambio.id}>
                <span className="tabular-nums">{fecha(cambio.cambiado_en)}</span>
                {' · '}
                {nombreUsuario.get(cambio.usuario_id) ?? '—'}
                {' · '}
                {t(`danos.estados.${cambio.estado_anterior}`)} →{' '}
                {t(`danos.estados.${cambio.estado_nuevo}`)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
