import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type Idioma } from '@/api/esquemas';

export interface SelectorIdiomaProps {
  idiomaActual: string;
  alCambiar: (idioma: Idioma) => void;
  deshabilitado?: boolean;
  variante?: 'claro' | 'oscuro';
}

const OPCIONES_IDIOMA: { valor: Idioma; etiqueta: string }[] = [
  { valor: 'es', etiqueta: 'ES' },
  { valor: 'en', etiqueta: 'EN' },
  { valor: 'pt', etiqueta: 'PT' },
];

export function SelectorIdioma({
  idiomaActual,
  alCambiar,
  deshabilitado = false,
  variante = 'claro',
}: SelectorIdiomaProps) {
  const { t } = useTranslation();

  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={t('accesibilidad.idioma_rapido')}
    >
      <Globe
        className={`h-4 w-4 shrink-0 ${
          variante === 'oscuro' ? 'text-sky-200' : 'text-slate-500 dark:text-slate-400'
        }`}
        aria-hidden="true"
      />
      <div
        className={[
          'inline-flex rounded-xl border p-0.5',
          variante === 'oscuro'
            ? 'border-white/20 bg-white/10'
            : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800',
        ].join(' ')}
      >
        {OPCIONES_IDIOMA.map((op) => {
          const activo = idiomaActual.startsWith(op.valor);
          return (
            <button
              key={op.valor}
              type="button"
              disabled={deshabilitado}
              onClick={() => {
                alCambiar(op.valor);
              }}
              aria-pressed={activo}
              aria-label={t(`idiomas.${op.valor}`)}
              className={[
                'min-h-[34px] min-w-[36px] cursor-pointer rounded-lg px-2 text-xs font-bold transition-colors disabled:opacity-50',
                activo
                  ? variante === 'oscuro'
                    ? 'bg-white text-primario-900 shadow-xs'
                    : 'bg-white text-primario-700 shadow-xs dark:bg-primario-500 dark:text-white'
                  : variante === 'oscuro'
                    ? 'text-sky-100 hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
              ].join(' ')}
            >
              {op.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}
