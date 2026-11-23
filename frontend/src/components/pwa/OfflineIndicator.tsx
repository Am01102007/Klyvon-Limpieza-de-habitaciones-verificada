import { RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useEstadoRedYCola } from '@/offline/hooks';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const { enLinea, pendientes, conError, sincronizando, sincronizarAhora, reintentarErrores } =
    useEstadoRedYCola();

  if (enLinea && pendientes === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'border-b px-4 py-2 text-xs font-medium sm:text-sm',
        !enLinea
          ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100'
          : conError > 0
            ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/80 dark:text-red-100'
            : 'border-primario-200 bg-primario-50 text-primario-900 dark:border-primario-800 dark:bg-primario-950/80 dark:text-sky-100',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!enLinea ? (
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${sincronizando ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          )}
          <span>
            {!enLinea
              ? t('offline.sin_conexion')
              : sincronizando
                ? t('offline.sincronizando')
                : conError > 0
                  ? t('offline.error_sync')
                  : t('offline.pendientes_sync', { cantidad: pendientes })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!enLinea && pendientes > 0 && (
            <span className="font-semibold tabular-nums">
              {t('offline.pendientes_sync', { cantidad: pendientes })}
            </span>
          )}
          {enLinea && pendientes > 0 && !sincronizando && (
            <button
              type="button"
              onClick={() => {
                void (conError > 0 ? reintentarErrores() : sincronizarAhora());
              }}
              className="min-h-[34px] cursor-pointer rounded-lg border border-current/25 px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
            >
              {conError > 0 ? t('offline.reintentar_errores') : t('offline.sincronizar_ahora')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
