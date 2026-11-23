import { PauseCircle, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MotivoPausa, type Pausa } from '@/api/esquemas';
import { formatearCronometro } from '@/utils/fecha';

import { calcularSegundosNetosTranscurridos } from './cronometro';

export interface CronometroLimpiezaProps {
  inicioIso: string | null;
  pausas: readonly Pick<Pausa, 'inicio' | 'fin' | 'motivo'>[];
  duracionNetaFija?: number | null;
  motivoPausaAbierta?: MotivoPausa | null;
}

export function CronometroLimpieza({
  inicioIso,
  pausas,
  duracionNetaFija = null,
  motivoPausaAbierta = null,
}: CronometroLimpiezaProps) {
  const { t } = useTranslation();
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

  const pausaAbierta = motivoPausaAbierta !== null || pausas.some((p) => p.fin === null);
  const activo = Boolean(inicioIso) && duracionNetaFija === null && !pausaAbierta;

  useEffect(() => {
    if (!activo) {
      return;
    }
    const id = window.setInterval(() => {
      setAhoraMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [activo]);

  const segundos = calcularSegundosNetosTranscurridos(inicioIso, pausas, ahoraMs, duracionNetaFija);

  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-2 rounded-2xl border p-6 text-center',
        pausaAbierta
          ? 'border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40'
          : 'border-primario-200 bg-primario-50/50 dark:border-primario-800 dark:bg-primario-950/40',
      ].join(' ')}
    >
      <span className="text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-300">
        {t('limpieza.limpiando.cronometro_label')}
      </span>

      <p
        className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums sm:text-5xl dark:text-white"
        aria-live="off"
      >
        {formatearCronometro(segundos)}
      </p>

      <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
        {pausaAbierta ? (
          <>
            <PauseCircle
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <span className="text-amber-900 dark:text-amber-200">
              {motivoPausaAbierta
                ? t('limpieza.limpiando.pausa_actual', {
                    motivo: t(`limpieza.limpiando.motivos.${motivoPausaAbierta}`),
                  })
                : t('limpieza.limpiando.estado_pausado')}
            </span>
          </>
        ) : (
          <>
            <PlayCircle
              className="h-4 w-4 text-primario-600 dark:text-sky-400"
              aria-hidden="true"
            />
            <span className="text-primario-800 dark:text-sky-200">
              {t('limpieza.limpiando.estado_corriendo')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
