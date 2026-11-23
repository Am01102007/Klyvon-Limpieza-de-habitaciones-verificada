import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  cargando?: boolean;
  anchoCompleto?: boolean;
  icono?: ReactNode;
}

const ESTILOS_VARIANTE: Record<VarianteBoton, string> = {
  primario:
    'bg-primario-500 text-white hover:bg-primario-600 active:bg-primario-700 disabled:bg-primario-200 disabled:text-white dark:disabled:bg-primario-900 dark:disabled:text-slate-400',
  secundario:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 dark:active:bg-slate-600 dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
  peligro:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-200 disabled:text-white dark:disabled:bg-red-950 dark:disabled:text-red-300',
  fantasma:
    'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 dark:disabled:text-slate-500',
};

export function Boton({
  variante = 'primario',
  cargando = false,
  anchoCompleto = false,
  icono,
  children,
  disabled,
  type = 'button',
  className = '',
  ...resto
}: BotonProps) {
  const deshabilitado = Boolean(disabled) || cargando;

  return (
    <button
      type={type}
      disabled={deshabilitado}
      className={[
        'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-medium transition-colors',
        'cursor-pointer disabled:cursor-not-allowed',
        ESTILOS_VARIANTE[variante],
        anchoCompleto ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...resto}
    >
      {cargando ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        icono && (
          <span className="shrink-0" aria-hidden="true">
            {icono}
          </span>
        )
      )}
      <span>{children}</span>
    </button>
  );
}
