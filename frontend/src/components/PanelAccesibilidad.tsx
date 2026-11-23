import { Contrast, RotateCcw, Sparkles, Sun, Moon, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePreferencias } from '@/app/PreferenciasProvider';
import { type TamanoFuente } from '@/utils/storage';

import { Boton } from './Boton';

const TAMANOS: { valor: TamanoFuente; clave: string }[] = [
  { valor: 'normal', clave: 'accesibilidad.fuente_normal' },
  { valor: 'grande', clave: 'accesibilidad.fuente_grande' },
  { valor: 'muy_grande', clave: 'accesibilidad.fuente_muy_grande' },
];

export function PanelAccesibilidad() {
  const { t } = useTranslation();
  const {
    tema,
    tamanoFuente,
    altoContraste,
    movimientoReducido,
    establecerTema,
    establecerTamanoFuente,
    establecerAltoContraste,
    establecerMovimientoReducido,
    restablecerPreferencias,
  } = usePreferencias();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          {t('accesibilidad.tema')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={tema === 'claro'}
            onClick={() => {
              establecerTema('claro');
            }}
            className={[
              'flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
              tema === 'claro'
                ? 'border-primario-500 bg-primario-50 text-primario-800 dark:bg-primario-500/20 dark:text-sky-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('accesibilidad.tema_claro')}</span>
          </button>
          <button
            type="button"
            aria-pressed={tema === 'oscuro'}
            onClick={() => {
              establecerTema('oscuro');
            }}
            className={[
              'flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
              tema === 'oscuro'
                ? 'border-primario-500 bg-primario-50 text-primario-800 dark:bg-primario-500/20 dark:text-sky-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('accesibilidad.tema_oscuro')}</span>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Type className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {t('accesibilidad.tamano_fuente')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TAMANOS.map((item) => {
            const activo = tamanoFuente === item.valor;
            return (
              <button
                key={item.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  establecerTamanoFuente(item.valor);
                }}
                className={[
                  'min-h-[48px] cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors sm:text-sm',
                  activo
                    ? 'border-primario-500 bg-primario-50 text-primario-800 dark:bg-primario-500/20 dark:text-sky-200'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                {t(item.clave)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={altoContraste}
          onClick={() => {
            establecerAltoContraste(!altoContraste);
          }}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800"
        >
          <div className="flex items-start gap-2.5">
            <Contrast
              className="mt-0.5 h-5 w-5 shrink-0 text-primario-600 dark:text-sky-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('accesibilidad.alto_contraste')}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t('accesibilidad.alto_contraste_desc')}
              </p>
            </div>
          </div>
          <span
            className={[
              'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold',
              altoContraste
                ? 'bg-primario-500 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
            ].join(' ')}
          >
            {altoContraste ? t('accesibilidad.activado') : t('accesibilidad.desactivado')}
          </span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={movimientoReducido}
          onClick={() => {
            establecerMovimientoReducido(!movimientoReducido);
          }}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800"
        >
          <div className="flex items-start gap-2.5">
            <Sparkles
              className="mt-0.5 h-5 w-5 shrink-0 text-primario-600 dark:text-sky-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('accesibilidad.movimiento_reducido')}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t('accesibilidad.movimiento_reducido_desc')}
              </p>
            </div>
          </div>
          <span
            className={[
              'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold',
              movimientoReducido
                ? 'bg-primario-500 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
            ].join(' ')}
          >
            {movimientoReducido ? t('accesibilidad.activado') : t('accesibilidad.desactivado')}
          </span>
        </button>
      </div>

      <Boton
        variante="secundario"
        anchoCompleto
        icono={<RotateCcw className="h-4 w-4" />}
        onClick={restablecerPreferencias}
      >
        {t('accesibilidad.restablecer')}
      </Boton>
    </div>
  );
}
