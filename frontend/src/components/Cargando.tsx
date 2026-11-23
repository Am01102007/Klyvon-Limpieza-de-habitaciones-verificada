import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface CargandoProps {
  mensaje?: string;
  pantallaCompleta?: boolean;
}

export function Cargando({ mensaje, pantallaCompleta = false }: CargandoProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex flex-col items-center justify-center gap-3 p-6 text-slate-600 dark:text-slate-300',
        pantallaCompleta ? 'min-h-screen bg-slate-50 dark:bg-slate-950' : 'py-12',
      ].join(' ')}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primario-500" aria-hidden="true" />
      <p className="text-sm font-medium">{mensaje ?? t('comun.cargando')}</p>
    </div>
  );
}
