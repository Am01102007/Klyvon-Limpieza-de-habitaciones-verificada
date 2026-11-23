import { AlertTriangle, ArrowRight, Building2, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { type TareaDelDia } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla } from '@/components/ErrorPantalla';
import { InsigniaEstado, type TipoInsigniaEstado } from '@/components/InsigniaEstado';
import { MascotaKlyvon } from '@/components/MascotaKlyvon';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Vacio } from '@/components/Vacio';
import { formatearHoraLimite } from '@/utils/fecha';

import { useTareasHoy } from './hooks';

const LIMITE_POR_PAGINA = 50;

function obtenerInsigniaRevision(tarea: TareaDelDia): TipoInsigniaEstado | null {
  if (tarea.estado_trabajo !== 'enviada') {
    return null;
  }
  switch (tarea.estado_revision) {
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

export function TareasHoyPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [desplazamiento, setDesplazamiento] = useState(0);

  const { data, isPending, isError, error, refetch, isFetching } = useTareasHoy(
    LIMITE_POR_PAGINA,
    desplazamiento,
  );

  if (isPending) {
    return <Cargando />;
  }

  if (isError) {
    return (
      <ErrorPantalla
        error={error}
        alReintentar={() => {
          void refetch();
        }}
      />
    );
  }

  const tareas = data.items;
  const hayOtraEnCurso = tareas.some((item) => item.estado_trabajo === 'en_curso');
  const totalPendientes = tareas.filter((item) => item.estado_trabajo === 'pendiente').length;
  const totalEnCurso = tareas.filter((item) => item.estado_trabajo === 'en_curso').length;
  const totalEnviadas = tareas.filter((item) => item.estado_trabajo === 'enviada').length;
  const tieneAnterior = desplazamiento > 0;
  const tieneSiguiente = desplazamiento + tareas.length < data.total;

  return (
    <div className="flex flex-col gap-4">
      <section className="klyvon-canvas-claro rounded-2xl border border-slate-200 p-4 shadow-xs sm:p-5 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-primario-600 uppercase dark:text-sky-400">
              {t('tareas.saludo')}
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
              {t('tareas.titulo')}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 tabular-nums dark:text-slate-300">
              {t('tareas.subtitulo', { cantidad: data.total })}
            </p>
          </div>

          <MascotaKlyvon tamano="mediano" animada className="shrink-0" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/80">
            <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white">
              {totalPendientes}
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('tareas.resumen_pendientes')}
            </p>
          </div>
          <div className="rounded-xl bg-primario-50 px-3 py-2 text-center dark:bg-primario-950/70">
            <p className="text-lg font-bold text-primario-700 tabular-nums dark:text-sky-300">
              {totalEnCurso}
            </p>
            <p className="text-xs font-medium text-primario-800 dark:text-sky-200">
              {t('tareas.resumen_en_curso')}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-950/70">
            <p className="text-lg font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
              {totalEnviadas}
            </p>
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
              {t('tareas.resumen_enviadas')}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Boton
            variante="secundario"
            cargando={isFetching}
            icono={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              void refetch();
            }}
          >
            {t('tareas.actualizar')}
          </Boton>
        </div>
      </section>

      {hayOtraEnCurso && (
        <NotificacionEstado tipo="info" mensaje={t('tareas.aviso_otra_abierta')} />
      )}

      {tareas.length === 0 ? (
        <Vacio titulo={t('tareas.vacio_titulo')} descripcion={t('tareas.vacio_descripcion')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {tareas.map((tarea) => {
            const esCorreccion = tarea.tipo === 'correccion';
            const estaEnCurso = tarea.estado_trabajo === 'en_curso';
            const estaEnviada = tarea.estado_trabajo === 'enviada';
            const bloqueadaPorOtra = tarea.estado_trabajo === 'pendiente' && hayOtraEnCurso;
            const insigniaRevision = obtenerInsigniaRevision(tarea);

            return (
              <li
                key={tarea.limpieza_id}
                className={[
                  'rounded-2xl border bg-white p-4 shadow-xs transition-colors sm:p-5 dark:bg-slate-900',
                  esCorreccion
                    ? 'border-amber-300 bg-amber-50/30 dark:border-amber-700 dark:bg-amber-950/30'
                    : estaEnCurso
                      ? 'border-primario-300 ring-1 ring-primario-100 dark:border-primario-700 dark:ring-primario-900'
                      : 'border-slate-200 dark:border-slate-800',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {esCorreccion && (
                      <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        <span>{t('tareas.etiqueta_correccion')}</span>
                      </div>
                    )}
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {tarea.habitacion_nombre}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{tarea.propiedad_nombre}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700 tabular-nums dark:text-slate-200">
                        {t('tareas.prioridad', { valor: tarea.prioridad })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <InsigniaEstado estado={tarea.estado_trabajo} />
                    {insigniaRevision && <InsigniaEstado estado={insigniaRevision} />}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-600 tabular-nums dark:text-slate-300">
                  <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span>
                    {tarea.hora_limite
                      ? t('tareas.hora_limite', {
                          hora: formatearHoraLimite(tarea.hora_limite, tarea.fecha, i18n.language),
                        })
                      : t('tareas.sin_hora_limite')}
                  </span>
                </div>

                {tarea.comentario_rechazo && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200">
                    <p className="font-semibold">{t('tareas.motivo_rechazo')}:</p>
                    <p className="mt-0.5">{tarea.comentario_rechazo}</p>
                  </div>
                )}

                <div className="mt-4">
                  {estaEnviada ? (
                    <Boton variante="secundario" anchoCompleto disabled>
                      {t('tareas.accion_enviada')}
                    </Boton>
                  ) : (
                    <Boton
                      variante={estaEnCurso ? 'primario' : 'secundario'}
                      anchoCompleto
                      disabled={bloqueadaPorOtra}
                      icono={<ArrowRight className="h-4 w-4" />}
                      onClick={() => {
                        void navigate(`/empleado/limpiezas/${tarea.limpieza_id}`, {
                          state: { tarea },
                        });
                      }}
                    >
                      {estaEnCurso ? t('tareas.accion_continuar') : t('tareas.accion_iniciar')}
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(tieneAnterior || tieneSiguiente) && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Boton
            variante="secundario"
            disabled={!tieneAnterior}
            onClick={() => {
              setDesplazamiento((prev) => Math.max(0, prev - LIMITE_POR_PAGINA));
            }}
          >
            {t('nav.volver')}
          </Boton>
          <Boton
            variante="secundario"
            disabled={!tieneSiguiente}
            onClick={() => {
              setDesplazamiento((prev) => prev + LIMITE_POR_PAGINA);
            }}
          >
            {t('limpieza.entrada.continuar')}
          </Boton>
        </div>
      )}
    </div>
  );
}
