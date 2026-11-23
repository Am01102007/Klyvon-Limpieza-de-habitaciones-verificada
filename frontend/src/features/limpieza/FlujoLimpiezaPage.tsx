import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Pause,
  Play,
  PlusCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';

import { type MotivoPausa, type Pausa, type TareaDelDia } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { InsigniaEstado } from '@/components/InsigniaEstado';
import { Modal } from '@/components/Modal';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { encolarOperacionOffline, esErrorDeRed } from '@/offline/colaSync';
import { useTareasHoy } from '@/features/tareas/hooks';
import { useOperacionesPendientesLimpieza } from '@/offline/hooks';

import { CamaraEnVivo } from './CamaraEnVivo';
import { CronometroLimpieza } from './CronometroLimpieza';
import { type DatosNuevoDano, FormularioDano } from './FormularioDano';
import {
  useCrearPausa,
  useDetalleLimpieza,
  useFinalizarLimpieza,
  useIniciarLimpieza,
  useReanudarPausa,
  useReportarDano,
  useSubirFoto,
} from './hooks';

type PasoLimpieza = 'entrada' | 'danos' | 'limpiando' | 'salida';

interface LocationStateTarea {
  tarea?: TareaDelDia;
}

interface FotoVisual {
  id: string;
  url: string;
  esLocal: boolean;
}

const MOTIVOS_PAUSA: MotivoPausa[] = ['descanso', 'falta_insumos', 'huesped_en_habitacion'];

export function FlujoLimpiezaPage() {
  const { t } = useTranslation();
  const { limpiezaId = '' } = useParams<{ limpiezaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const estadoNavegacion = location.state as LocationStateTarea | null;
  // La lista del día (con copia local) manda; el estado de navegación se pierde al recargar.
  const tareasHoy = useTareasHoy();
  const tareaNavegacion =
    tareasHoy.data?.items.find((tarea) => tarea.limpieza_id === limpiezaId) ??
    estadoNavegacion?.tarea;

  const { data: detalle, isPending, isError, error, refetch } = useDetalleLimpieza(limpiezaId);
  const operacionesPendientes = useOperacionesPendientesLimpieza(limpiezaId);

  const iniciarMutation = useIniciarLimpieza(limpiezaId);
  const subirFotoMutation = useSubirFoto(limpiezaId);
  const reportarDanoMutation = useReportarDano(limpiezaId);
  const crearPausaMutation = useCrearPausa(limpiezaId);
  const reanudarPausaMutation = useReanudarPausa(limpiezaId);
  const finalizarMutation = useFinalizarLimpieza(limpiezaId);

  const [pasoActual, setPasoActual] = useState<PasoLimpieza>('entrada');
  const [pasoInicializado, setPasoInicializado] = useState(false);
  const [camaraMomento, setCamaraMomento] = useState<'entrada' | 'salida' | null>(null);
  const [mostrarFormDano, setMostrarFormDano] = useState(false);
  const [modalPausaAbierto, setModalPausaAbierto] = useState(false);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<MotivoPausa>('descanso');
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [avisoOffline, setAvisoOffline] = useState<string | null>(null);
  const [urlsLocales, setUrlsLocales] = useState<Record<string, string>>({});

  useEffect(() => {
    const nuevasUrls: Record<string, string> = {};
    for (const op of operacionesPendientes) {
      if (op.tipo === 'iniciar' || op.tipo === 'foto') {
        nuevasUrls[op.uuidOperacion] = URL.createObjectURL(op.archivo);
      }
    }
    // Sincroniza con un recurso externo (object URLs de las fotos en cola) y los libera al cambiar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlsLocales(nuevasUrls);
    return () => {
      Object.values(nuevasUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [operacionesPendientes]);

  const fotosMinEntrada = tareaNavegacion?.fotos_min_entrada ?? 1;
  const fotosMinSalida = tareaNavegacion?.fotos_min_salida ?? 1;

  const estadoDerivado = useMemo(() => {
    const fotosServidor = detalle?.fotos ?? [];
    const fotosEntradaServidor: FotoVisual[] = fotosServidor
      .filter((f) => f.momento === 'entrada')
      .map((f) => ({ id: f.id, url: f.url, esLocal: false }));
    const fotosSalidaServidor: FotoVisual[] = fotosServidor
      .filter((f) => f.momento === 'salida')
      .map((f) => ({ id: f.id, url: f.url, esLocal: false }));

    const fotosEntradaLocales: FotoVisual[] = [];
    const fotosSalidaLocales: FotoVisual[] = [];
    const danosLocales: {
      id: string;
      categoria: 'rotura' | 'mancha' | 'faltante' | 'aparato' | 'otro';
      gravedad: 'leve' | 'urgente';
      nota: string | null;
      esLocal: boolean;
    }[] = [];

    const pausasCombinadas: Pick<Pausa, 'id' | 'motivo' | 'inicio' | 'fin'>[] = [
      ...(detalle?.pausas ?? []),
    ];

    let inicioLocalIso: string | null = null;
    let iniciadaLocalmente = false;
    let finalizadaLocalmente = false;

    for (const op of operacionesPendientes) {
      if (op.tipo === 'iniciar') {
        iniciadaLocalmente = true;
        inicioLocalIso = inicioLocalIso ?? op.creadoEn;
        const url = urlsLocales[op.uuidOperacion];
        if (url) {
          fotosEntradaLocales.push({ id: op.fotoId, url, esLocal: true });
        }
      } else if (op.tipo === 'foto') {
        const url = urlsLocales[op.uuidOperacion];
        if (url) {
          const item: FotoVisual = { id: op.fotoId, url, esLocal: true };
          if (op.momento === 'entrada') {
            fotosEntradaLocales.push(item);
          } else {
            fotosSalidaLocales.push(item);
          }
        }
      } else if (op.tipo === 'dano') {
        danosLocales.push({
          id: op.danoId,
          categoria: op.categoria,
          gravedad: op.gravedad,
          nota: op.nota ?? null,
          esLocal: true,
        });
      } else if (op.tipo === 'pausa_crear') {
        pausasCombinadas.push({
          id: op.pausaId,
          motivo: op.motivo,
          inicio: op.creadoEn,
          fin: null,
        });
      } else if (op.tipo === 'pausa_reanudar') {
        for (let idx = pausasCombinadas.length - 1; idx >= 0; idx -= 1) {
          const candidata = pausasCombinadas[idx];
          if (candidata && candidata.fin === null) {
            pausasCombinadas[idx] = { ...candidata, fin: op.creadoEn };
            break;
          }
        }
      } else {
        finalizadaLocalmente = true;
      }
    }

    const estadoTrabajoServidor = detalle?.limpieza.estado_trabajo ?? 'pendiente';
    const enviadaEfectiva = estadoTrabajoServidor === 'enviada' || finalizadaLocalmente;
    const enCursoEfectivo =
      !enviadaEfectiva && (estadoTrabajoServidor === 'en_curso' || iniciadaLocalmente);

    const fotosEntrada = [...fotosEntradaServidor, ...fotosEntradaLocales];
    const fotosSalida = [...fotosSalidaServidor, ...fotosSalidaLocales];
    const danos = [
      ...(detalle?.danos ?? []).map((d) => ({ ...d, esLocal: false })),
      ...danosLocales,
    ];
    const pausaAbierta = pausasCombinadas.find((p) => p.fin === null) ?? null;

    return {
      enviadaEfectiva,
      enCursoEfectivo,
      inicioEfectivo: detalle?.limpieza.inicio ?? inicioLocalIso,
      fotosEntrada,
      fotosSalida,
      danos,
      pausas: pausasCombinadas,
      pausaAbierta,
    };
  }, [detalle, operacionesPendientes, urlsLocales]);

  // Elige el paso inicial una sola vez, cuando llegan los datos (ajuste de estado durante el render).
  if (detalle && !pasoInicializado) {
    let pasoInicial: PasoLimpieza = 'entrada';
    if (estadoDerivado.enCursoEfectivo) {
      if (estadoDerivado.fotosSalida.length > 0) {
        pasoInicial = 'salida';
      } else if (estadoDerivado.fotosEntrada.length >= fotosMinEntrada) {
        pasoInicial = 'limpiando';
      }
    }
    setPasoActual(pasoInicial);
    setPasoInicializado(true);
  }

  if (isPending) {
    return <Cargando mensaje={t('limpieza.cargando')} />;
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

  const puedeAvanzarEntrada =
    estadoDerivado.enCursoEfectivo && estadoDerivado.fotosEntrada.length >= fotosMinEntrada;
  const puedeFinalizar =
    estadoDerivado.enCursoEfectivo &&
    !estadoDerivado.pausaAbierta &&
    estadoDerivado.fotosSalida.length >= fotosMinSalida;

  const guardarOffline = async (
    operacion: Parameters<typeof encolarOperacionOffline>[0],
  ): Promise<void> => {
    await encolarOperacionOffline(operacion);
    setErrorAccion(null);
    setAvisoOffline(t('offline.guardado_local'));
  };

  const manejarCapturaFoto = async (blob: Blob) => {
    if (!camaraMomento) {
      return;
    }
    setErrorAccion(null);
    setAvisoOffline(null);

    const fotoId = crypto.randomUUID();
    const esInicio = camaraMomento === 'entrada' && !estadoDerivado.enCursoEfectivo;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await guardarOffline(
        esInicio
          ? { limpiezaId, tipo: 'iniciar', fotoId, archivo: blob }
          : { limpiezaId, tipo: 'foto', momento: camaraMomento, fotoId, archivo: blob },
      );
      setCamaraMomento(null);
      return;
    }

    try {
      if (esInicio) {
        await iniciarMutation.mutateAsync({ archivo: blob, fotoId });
      } else {
        await subirFotoMutation.mutateAsync({ momento: camaraMomento, archivo: blob, fotoId });
      }
      setCamaraMomento(null);
    } catch (err) {
      if (esErrorDeRed(err)) {
        await guardarOffline(
          esInicio
            ? { limpiezaId, tipo: 'iniciar', fotoId, archivo: blob }
            : { limpiezaId, tipo: 'foto', momento: camaraMomento, fotoId, archivo: blob },
        );
        setCamaraMomento(null);
        return;
      }
      setErrorAccion(traducirError(err, t));
    }
  };

  const manejarEnviarDano = async (datos: DatosNuevoDano) => {
    setErrorAccion(null);
    setAvisoOffline(null);
    const danoId = crypto.randomUUID();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await guardarOffline({
        limpiezaId,
        tipo: 'dano',
        danoId,
        categoria: datos.categoria,
        gravedad: datos.gravedad,
        nota: datos.nota,
        archivo: datos.archivo,
      });
      setMostrarFormDano(false);
      return;
    }

    try {
      await reportarDanoMutation.mutateAsync({
        categoria: datos.categoria,
        gravedad: datos.gravedad,
        archivo: datos.archivo,
        nota: datos.nota,
        danoId,
      });
      setMostrarFormDano(false);
    } catch (err) {
      if (esErrorDeRed(err)) {
        await guardarOffline({
          limpiezaId,
          tipo: 'dano',
          danoId,
          categoria: datos.categoria,
          gravedad: datos.gravedad,
          nota: datos.nota,
          archivo: datos.archivo,
        });
        setMostrarFormDano(false);
        return;
      }
      setErrorAccion(traducirError(err, t));
    }
  };

  const manejarCrearPausa = async () => {
    setErrorAccion(null);
    setAvisoOffline(null);
    const pausaId = crypto.randomUUID();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await guardarOffline({
        limpiezaId,
        tipo: 'pausa_crear',
        pausaId,
        motivo: motivoSeleccionado,
      });
      setModalPausaAbierto(false);
      return;
    }

    try {
      await crearPausaMutation.mutateAsync({ motivo: motivoSeleccionado, id: pausaId });
      setModalPausaAbierto(false);
    } catch (err) {
      if (esErrorDeRed(err)) {
        await guardarOffline({
          limpiezaId,
          tipo: 'pausa_crear',
          pausaId,
          motivo: motivoSeleccionado,
        });
        setModalPausaAbierto(false);
        return;
      }
      setErrorAccion(traducirError(err, t));
    }
  };

  const manejarReanudar = async () => {
    setErrorAccion(null);
    setAvisoOffline(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await guardarOffline({ limpiezaId, tipo: 'pausa_reanudar' });
      return;
    }

    try {
      await reanudarPausaMutation.mutateAsync();
    } catch (err) {
      if (esErrorDeRed(err)) {
        await guardarOffline({ limpiezaId, tipo: 'pausa_reanudar' });
        return;
      }
      setErrorAccion(traducirError(err, t));
    }
  };

  const manejarFinalizar = async () => {
    setErrorAccion(null);
    setAvisoOffline(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await guardarOffline({ limpiezaId, tipo: 'finalizar' });
      return;
    }

    try {
      await finalizarMutation.mutateAsync();
    } catch (err) {
      if (esErrorDeRed(err)) {
        await guardarOffline({ limpiezaId, tipo: 'finalizar' });
        return;
      }
      setErrorAccion(traducirError(err, t));
    }
  };

  if (estadoDerivado.enviadaEfectiva) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('limpieza.salida.enviada_titulo')}
          </h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {t('limpieza.salida.enviada_detalle')}
          </p>
          {avisoOffline && (
            <div className="mt-3 text-left">
              <NotificacionEstado tipo="info" mensaje={avisoOffline} />
            </div>
          )}
          <div className="mt-5">
            <Boton
              variante="primario"
              anchoCompleto
              onClick={() => {
                void navigate('/empleado');
              }}
            >
              {t('limpieza.volver_lista')}
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  const pasosOrdenados: { id: PasoLimpieza; etiqueta: string; habilitado: boolean }[] = [
    { id: 'entrada', etiqueta: t('limpieza.pasos.entrada'), habilitado: true },
    { id: 'danos', etiqueta: t('limpieza.pasos.danos'), habilitado: puedeAvanzarEntrada },
    { id: 'limpiando', etiqueta: t('limpieza.pasos.limpiando'), habilitado: puedeAvanzarEntrada },
    {
      id: 'salida',
      etiqueta: t('limpieza.pasos.salida'),
      habilitado: puedeAvanzarEntrada && !estadoDerivado.pausaAbierta,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Boton
          variante="fantasma"
          icono={<ArrowLeft className="h-4 w-4" />}
          onClick={() => {
            void navigate('/empleado');
          }}
        >
          {t('nav.volver')}
        </Boton>
        <InsigniaEstado estado={estadoDerivado.enCursoEfectivo ? 'en_curso' : 'pendiente'} />
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
          {t('limpieza.titulo_habitacion', { nombre: detalle.habitacion_nombre })}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{detalle.fecha}</p>
      </div>

      <nav aria-label={t('limpieza.titulo_habitacion', { nombre: detalle.habitacion_nombre })}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pasosOrdenados.map((paso) => {
            const activo = pasoActual === paso.id;
            return (
              <li key={paso.id}>
                <button
                  type="button"
                  disabled={!paso.habilitado}
                  onClick={() => {
                    setPasoActual(paso.id);
                    setCamaraMomento(null);
                  }}
                  aria-current={activo ? 'step' : undefined}
                  className={[
                    'min-h-[48px] w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    activo
                      ? 'border-primario-500 bg-primario-500 text-white'
                      : paso.habilitado
                        ? 'cursor-pointer border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600',
                  ].join(' ')}
                >
                  {paso.etiqueta}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {avisoOffline && <NotificacionEstado tipo="info" mensaje={avisoOffline} />}
      {errorAccion && <NotificacionEstado tipo="error" mensaje={errorAccion} />}

      {pasoActual === 'entrada' && (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('limpieza.entrada.titulo')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t('limpieza.entrada.descripcion', { min: fotosMinEntrada })}
            </p>
            <p className="mt-2 text-sm font-semibold text-primario-700 tabular-nums dark:text-sky-300">
              {t('limpieza.entrada.contador', {
                actual: estadoDerivado.fotosEntrada.length,
                min: fotosMinEntrada,
              })}
            </p>
          </div>

          {estadoDerivado.fotosEntrada.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {estadoDerivado.fotosEntrada.map((foto, idx) => (
                <div
                  key={foto.id}
                  className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={foto.url}
                    alt={t('limpieza.entrada.alt_foto', { numero: idx + 1 })}
                    className="aspect-4/3 w-full object-cover"
                  />
                  {foto.esLocal && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-md bg-amber-900/85 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100">
                      {t('offline.etiqueta_local')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {camaraMomento === 'entrada' ? (
            <CamaraEnVivo
              alCapturar={manejarCapturaFoto}
              alCancelar={() => {
                setCamaraMomento(null);
              }}
              procesandoExterno={iniciarMutation.isPending || subirFotoMutation.isPending}
            />
          ) : (
            <Boton
              variante="primario"
              anchoCompleto
              icono={<Camera className="h-5 w-5" />}
              onClick={() => {
                setCamaraMomento('entrada');
              }}
            >
              {estadoDerivado.enCursoEfectivo
                ? t('limpieza.entrada.tomar_otra')
                : t('limpieza.entrada.tomar_primera')}
            </Boton>
          )}

          {!puedeAvanzarEntrada && (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('limpieza.entrada.requisito_minimo', { min: fotosMinEntrada })}
            </p>
          )}

          <Boton
            variante="secundario"
            anchoCompleto
            disabled={!puedeAvanzarEntrada}
            onClick={() => {
              setPasoActual('danos');
            }}
          >
            {t('limpieza.entrada.continuar')}
          </Boton>
        </section>
      )}

      {pasoActual === 'danos' && (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          {!mostrarFormDano ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('limpieza.danos.pregunta')}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t('limpieza.danos.descripcion')}
                </p>
              </div>

              {estadoDerivado.danos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t('limpieza.danos.lista_titulo', { cantidad: estadoDerivado.danos.length })}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {estadoDerivado.danos.map((dano) => (
                      <li
                        key={dano.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {t(`limpieza.danos.categorias.${dano.categoria}`)}
                          </p>
                          {dano.nota && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {dano.nota}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <InsigniaEstado
                            estado={dano.gravedad === 'urgente' ? 'dano_urgente' : 'dano_leve'}
                          />
                          {dano.esLocal && (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              {t('offline.etiqueta_local')}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Boton
                  variante="secundario"
                  anchoCompleto
                  icono={<PlusCircle className="h-4 w-4" />}
                  onClick={() => {
                    setMostrarFormDano(true);
                  }}
                >
                  {estadoDerivado.danos.length > 0
                    ? t('limpieza.danos.agregar_otro')
                    : t('limpieza.danos.si')}
                </Boton>
                <Boton
                  variante="primario"
                  anchoCompleto
                  onClick={() => {
                    setPasoActual('limpiando');
                  }}
                >
                  {estadoDerivado.danos.length > 0
                    ? t('limpieza.danos.continuar_limpieza')
                    : t('limpieza.danos.no')}
                </Boton>
              </div>
            </>
          ) : (
            <FormularioDano
              alEnviar={manejarEnviarDano}
              alCancelar={() => {
                setMostrarFormDano(false);
              }}
              enviando={reportarDanoMutation.isPending}
            />
          )}
        </section>
      )}

      {pasoActual === 'limpiando' && (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('limpieza.limpiando.titulo')}
          </h2>

          <CronometroLimpieza
            inicioIso={estadoDerivado.inicioEfectivo}
            pausas={estadoDerivado.pausas}
            motivoPausaAbierta={estadoDerivado.pausaAbierta?.motivo ?? null}
          />

          {estadoDerivado.pausaAbierta && (
            <NotificacionEstado tipo="info" mensaje={t('limpieza.limpiando.aviso_pausado')} />
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {estadoDerivado.pausaAbierta ? (
              <Boton
                variante="primario"
                anchoCompleto
                cargando={reanudarPausaMutation.isPending}
                icono={<Play className="h-5 w-5" />}
                onClick={() => {
                  void manejarReanudar();
                }}
              >
                {reanudarPausaMutation.isPending
                  ? t('limpieza.limpiando.reanudando')
                  : t('limpieza.limpiando.reanudar')}
              </Boton>
            ) : (
              <Boton
                variante="secundario"
                anchoCompleto
                icono={<Pause className="h-5 w-5" />}
                onClick={() => {
                  setModalPausaAbierto(true);
                }}
              >
                {t('limpieza.limpiando.pausar')}
              </Boton>
            )}

            <Boton
              variante="secundario"
              anchoCompleto
              icono={<AlertTriangle className="h-4 w-4" />}
              onClick={() => {
                setMostrarFormDano(true);
                setPasoActual('danos');
              }}
            >
              {t('limpieza.limpiando.reportar_dano_extra')}
            </Boton>
          </div>

          <Boton
            variante="primario"
            anchoCompleto
            disabled={Boolean(estadoDerivado.pausaAbierta)}
            icono={<Camera className="h-5 w-5" />}
            onClick={() => {
              setPasoActual('salida');
            }}
          >
            {t('limpieza.limpiando.ir_a_salida')}
          </Boton>
        </section>
      )}

      {pasoActual === 'salida' && (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('limpieza.salida.titulo')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t('limpieza.salida.descripcion', { min: fotosMinSalida })}
            </p>
            <p className="mt-2 text-sm font-semibold text-primario-700 tabular-nums dark:text-sky-300">
              {t('limpieza.salida.contador', {
                actual: estadoDerivado.fotosSalida.length,
                min: fotosMinSalida,
              })}
            </p>
          </div>

          {estadoDerivado.fotosSalida.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {estadoDerivado.fotosSalida.map((foto, idx) => (
                <div
                  key={foto.id}
                  className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={foto.url}
                    alt={t('limpieza.salida.alt_foto', { numero: idx + 1 })}
                    className="aspect-4/3 w-full object-cover"
                  />
                  {foto.esLocal && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-md bg-amber-900/85 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100">
                      {t('offline.etiqueta_local')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {camaraMomento === 'salida' ? (
            <CamaraEnVivo
              alCapturar={manejarCapturaFoto}
              alCancelar={() => {
                setCamaraMomento(null);
              }}
              procesandoExterno={subirFotoMutation.isPending}
            />
          ) : (
            <Boton
              variante="secundario"
              anchoCompleto
              icono={<Camera className="h-5 w-5" />}
              onClick={() => {
                setCamaraMomento('salida');
              }}
            >
              {t('limpieza.salida.tomar_foto')}
            </Boton>
          )}

          {estadoDerivado.fotosSalida.length < fotosMinSalida && (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('limpieza.salida.requisito_minimo', { min: fotosMinSalida })}
            </p>
          )}

          <Boton
            variante="primario"
            anchoCompleto
            disabled={!puedeFinalizar}
            cargando={finalizarMutation.isPending}
            icono={<CheckCircle2 className="h-5 w-5" />}
            onClick={() => {
              void manejarFinalizar();
            }}
          >
            {finalizarMutation.isPending
              ? t('limpieza.salida.finalizando')
              : t('limpieza.salida.finalizar')}
          </Boton>
        </section>
      )}

      <Modal
        abierto={modalPausaAbierto}
        titulo={t('limpieza.limpiando.elegir_motivo')}
        alCerrar={() => {
          setModalPausaAbierto(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label={t('limpieza.limpiando.elegir_motivo')}
          >
            {MOTIVOS_PAUSA.map((motivo) => {
              const seleccionado = motivoSeleccionado === motivo;
              return (
                <button
                  key={motivo}
                  type="button"
                  role="radio"
                  aria-checked={seleccionado}
                  onClick={() => {
                    setMotivoSeleccionado(motivo);
                  }}
                  className={[
                    'min-h-[48px] cursor-pointer rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                    seleccionado
                      ? 'border-primario-500 bg-primario-50 text-primario-800 dark:border-sky-400 dark:bg-primario-950/60 dark:text-sky-200'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
                  ].join(' ')}
                >
                  {t(`limpieza.limpiando.motivos.${motivo}`)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton
              variante="primario"
              anchoCompleto
              cargando={crearPausaMutation.isPending}
              onClick={() => {
                void manejarCrearPausa();
              }}
            >
              {crearPausaMutation.isPending
                ? t('limpieza.limpiando.pausando')
                : t('limpieza.limpiando.confirmar_pausa')}
            </Boton>
            <Boton
              variante="secundario"
              anchoCompleto
              disabled={crearPausaMutation.isPending}
              onClick={() => {
                setModalPausaAbierto(false);
              }}
            >
              {t('comun.cancelar')}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
