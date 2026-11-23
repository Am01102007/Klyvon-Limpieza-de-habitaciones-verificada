import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  accionDerecha?: ReactNode;
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  accionDerecha,
  id,
  className = '',
  ...resto
}: CampoProps) {
  const idGenerado = useId();
  const idInput = id ?? idGenerado;
  const idError = `${idInput}-error`;
  const idAyuda = `${idInput}-ayuda`;

  const describedBy = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idInput} className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {etiqueta}
      </label>
      <div className="relative flex items-center">
        <input
          id={idInput}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={[
            'min-h-[48px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
            'transition-colors disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
            error
              ? 'border-red-500 focus-visible:outline-red-600 dark:border-red-400'
              : 'border-slate-300 focus-visible:border-primario-500 dark:border-slate-700',
            accionDerecha ? 'pr-12' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...resto}
        />
        {accionDerecha && (
          <div className="absolute right-1.5 flex items-center">{accionDerecha}</div>
        )}
      </div>
      {ayuda && !error && (
        <p id={idAyuda} className="text-xs text-slate-600 dark:text-slate-400">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
