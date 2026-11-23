import { ArrowLeft, CheckCircle2, Clock, Expand, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';

import { type EstadoRevision } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { InsigniaEstado, type TipoInsigniaEstado } from '@/components/InsigniaEstado';
import { Modal } from '@/components/Modal';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { calcularSegundosNetosTranscurridos } from '@/features/limpieza/cronometro';
import { useDetalleLimpieza } from '@/features/limpieza/hooks';
import { formatearDuracionMinutos } from '@/utils/fecha';

import { useRevisarLimpieza } from './hooks';

function insigniaRevision(estado: EstadoRevision): TipoInsigniaEstado {
  switch (estado) {
    case 'pendiente':
      return 'por_revisar';
    case 'aprobada':
      return 'aprobada';
    case 'rechazada':
      return 'rechazada';
    case 'no_requerida':
      return 'no_requerida';
  }
}

export function DetalleRevisionPage() {
  const { t } = useTranslation();
  const { limpiezaId = '' } = useParams<{ limpiezaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const baseRuta = location.pathname.startsWith('/admin') ? '/admin' : '/supervisor';

  const detalleQuery = useDetalleLimpieza(limpiezaId);
  const revisarMutation = useRevisarLimpieza(limpiezaId);

  const [comentario, setComentario] = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; titulo: string } | null>(null);

  if (detalleQuery.isPending) {
    return <Cargando />;
  }

  if (detalleQuery.isError) {
    return (
      <ErrorPantalla
        error={detalleQuery.error}
        alReintentar={() => {
          void detalleQuery.refetch();
        }}
      />
    );
  }

  const detalle = detalleQuery.data;
  const fotosEntrada = detalle.fotos.filter((f) => f.momento === 'entrada');
  const fotosSalida = detalle.fotos.filter((f) => f.momento === 'salida');
  const duracionSeg =
    detalle.limpieza.duracion_neta_seg ??
    calcularSegundosNetosTranscurridos(detalle.limpieza.inicio, detalle.pausas);
  const puedeDictaminar =
    detalle.limpieza.estado_trabajo === 'enviada' &&
    detalle.limpieza.estado_revision === 'pendiente';

  const manejarDictamen = async (resultado: 'aprobada' | 'rechazada') => {
    setErrorForm(null);
    if (resultado === 'rechazada' && comentario.trim().length === 0) {
      setErrorForm(t('revisiones.comentario_requerido'));
      return;
    }

    try {
      await revisarMutation.mutateAsync({
        resultado,
        comentario: comentario.trim() || undefined,
      });
    } catch (err) {
      setErrorForm(traducirError(err, t));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Boton
          variante="fantasma"
          icono={<ArrowLeft className="h-4 w-4" />}
          onClick={() => {
            void navigate(baseRuta);
          }}
        >
          {t('revisiones.volver_cola')}
        </Boton>
        <InsigniaEstado estado={insigniaRevision(detalle.limpieza.estado_revision)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('limpieza.titulo_habitacion', { nombre: detalle.habitacion_nombre })}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 tabular-nums dark:text-slate-300">
              {detalle.fecha}
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 px-3.5 py-2 text-right dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('revisiones.duracion_neta')}
            </p>
            <p className="flex items-center justify-end gap-1.5 text-base font-bold text-slate-900 tabular-nums dark:text-white">
              <Clock className="h-4 w-4 text-primario-500" aria-hidden="true" />
              <span>{formatearDuracionMinutos(duracionSeg)}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('revisiones.fotos_entrada')}
          </h2>
          {fotosEntrada.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('revisiones.sin_fotos')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {fotosEntrada.map((foto, idx) => {
                const titulo = t('limpieza.entrada.alt_foto', { numero: idx + 1 });
                return (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => {
                      setFotoAmpliada({ url: foto.url, titulo });
                    }}
                    aria-label={`${t('revisiones.ampliar_foto')}: ${titulo}`}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={foto.url}
                      alt={titulo}
                      className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute right-2 bottom-2 rounded-lg bg-slate-900/70 p-1.5 text-white">
                      <Expand className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('revisiones.fotos_salida')}
          </h2>
          {fotosSalida.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('revisiones.sin_fotos')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {fotosSalida.map((foto, idx) => {
                const titulo = t('limpieza.salida.alt_foto', { numero: idx + 1 });
                return (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => {
                      setFotoAmpliada({ url: foto.url, titulo });
                    }}
                    aria-label={`${t('revisiones.ampliar_foto')}: ${titulo}`}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={foto.url}
                      alt={titulo}
                      className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute right-2 bottom-2 rounded-lg bg-slate-900/70 p-1.5 text-white">
                      <Expand className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('revisiones.pausas_titulo')}
          </h2>
          {detalle.pausas.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('revisiones.sin_pausas')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detalle.pausas.map((pausa) => (
                <li
                  key={pausa.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {t(`limpieza.limpiando.motivos.${pausa.motivo}`)}
                  </span>
                  <span className="text-xs text-slate-600 tabular-nums dark:text-slate-300">
                    {new Date(pausa.inicio).toLocaleTimeString()}
                    {pausa.fin ? ` – ${new Date(pausa.fin).toLocaleTimeString()}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('revisiones.danos_titulo')}
          </h2>
          {detalle.danos.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('revisiones.sin_danos')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {detalle.danos.map((dano) => {
                const fotoDano = detalle.fotos.find((f) => f.dano_id === dano.id);
                return (
                  <li
                    key={dano.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t(`limpieza.danos.categorias.${dano.categoria}`)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <InsigniaEstado
                          estado={dano.gravedad === 'urgente' ? 'dano_urgente' : 'dano_leve'}
                        />
                        <InsigniaEstado
                          estado={
                            dano.estado === 'abierto'
                              ? 'dano_abierto'
                              : dano.estado === 'en_reparacion'
                                ? 'dano_en_reparacion'
                                : 'dano_resuelto'
                          }
                        />
                      </div>
                    </div>
                    {dano.nota && (
                      <p className="text-sm text-slate-700 dark:text-slate-300">{dano.nota}</p>
                    )}
                    {fotoDano && (
                      <button
                        type="button"
                        onClick={() => {
                          setFotoAmpliada({
                            url: fotoDano.url,
                            titulo: t(`limpieza.danos.categorias.${dano.categoria}`),
                          });
                        }}
                        className="w-fit cursor-pointer text-xs font-semibold text-primario-700 underline dark:text-sky-300"
                      >
                        {t('danos.ver_foto')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('revisiones.dictamen_titulo')}
        </h2>

        {detalle.revision && (
          <NotificacionEstado
            tipo={detalle.revision.resultado === 'aprobada' ? 'exito' : 'error'}
            mensaje={`${t('revisiones.resultado_registrado', {
              resultado: t(`estados.${detalle.revision.resultado}`),
            })}${detalle.revision.comentario ? ` — ${detalle.revision.comentario}` : ''}`}
          />
        )}

        {puedeDictaminar && (
          <>
            {errorForm && <NotificacionEstado tipo="error" mensaje={errorForm} />}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="revision-comentario"
                className="text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                {t('revisiones.comentario_label')}
              </label>
              <textarea
                id="revision-comentario"
                rows={3}
                maxLength={500}
                value={comentario}
                disabled={revisarMutation.isPending}
                onChange={(e) => {
                  setComentario(e.target.value);
                  setErrorForm(null);
                }}
                placeholder={t('revisiones.comentario_placeholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Boton
                variante="primario"
                anchoCompleto
                cargando={revisarMutation.isPending}
                icono={<CheckCircle2 className="h-5 w-5" />}
                onClick={() => {
                  void manejarDictamen('aprobada');
                }}
              >
                {revisarMutation.isPending ? t('revisiones.aprobando') : t('revisiones.aprobar')}
              </Boton>
              <Boton
                variante="peligro"
                anchoCompleto
                cargando={revisarMutation.isPending}
                icono={<XCircle className="h-5 w-5" />}
                onClick={() => {
                  void manejarDictamen('rechazada');
                }}
              >
                {revisarMutation.isPending ? t('revisiones.rechazando') : t('revisiones.rechazar')}
              </Boton>
            </div>
          </>
        )}
      </section>

      <Modal
        abierto={fotoAmpliada !== null}
        titulo={fotoAmpliada?.titulo ?? ''}
        alCerrar={() => {
          setFotoAmpliada(null);
        }}
      >
        {fotoAmpliada && (
          <img
            src={fotoAmpliada.url}
            alt={fotoAmpliada.titulo}
            className="max-h-[75vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>
    </div>
  );
}
