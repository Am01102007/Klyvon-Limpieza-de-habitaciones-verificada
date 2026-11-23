import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export interface LogoKlyvonProps {
  tamano?: 'chico' | 'mediano' | 'grande';
  variante?: 'claro' | 'oscuro';
  className?: string;
}

const ESCALAS: Record<
  NonNullable<LogoKlyvonProps['tamano']>,
  { svg: string; titulo: string; slogan: string }
> = {
  chico: {
    svg: 'h-9 w-11',
    titulo: 'text-lg tracking-wider',
    slogan: 'text-[10px] tracking-wide',
  },
  mediano: {
    svg: 'h-11 w-14',
    titulo: 'text-xl tracking-wider',
    slogan: 'text-xs tracking-wide',
  },
  grande: {
    svg: 'h-14 w-16',
    titulo: 'text-2xl sm:text-3xl tracking-wider',
    slogan: 'text-xs sm:text-sm tracking-wide',
  },
};

export function LogoKlyvon({
  tamano = 'mediano',
  variante = 'claro',
  className = '',
}: LogoKlyvonProps) {
  const { t } = useTranslation();
  const gradId = useId();
  const escala = ESCALAS[tamano];

  return (
    <div
      className={`inline-flex items-center justify-center gap-3 select-none ${className}`}
      aria-label={`${t('app.nombre')} — ${t('app.eslogan')}`}
    >
      <svg viewBox="0 0 120 96" className={`${escala.svg} shrink-0`} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="8" y1="8" x2="104" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="55%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <path
          d="M14 14C14 9.5 17.5 6 22 6H35C41 6 45 10.5 45 16V48L14 72V14Z"
          fill={`url(#${gradId})`}
        />
        <path
          d="M17 77L69 12C72 8 76.5 6 81.5 6H98C101.5 6 103.5 10 101 13L46 61L17 77Z"
          fill="#0EA5E9"
        />
        <path
          d="M16 86C28 60 52 46 72 55C85 61 95 77 104 90C105.5 92.5 103.5 95 100 95H82C77 95 72.5 92.5 70 88C60 72 48 64 34 71C26 75 21 81 18 87C17 89 15 88 16 86Z"
          fill={`url(#${gradId})`}
        />
        <path d="M100 32L104 42L114 46L104 50L100 60L96 50L86 46L96 42L100 32Z" fill="#0EA5E9" />
      </svg>
      <div className="flex flex-col leading-none">
        <div className="flex items-start gap-0.5">
          <span
            className={[
              'font-black uppercase',
              escala.titulo,
              variante === 'oscuro' ? 'text-white' : 'text-slate-900 dark:text-white',
            ].join(' ')}
          >
            KLYVON
          </span>
          <span
            className={[
              'text-[9px] font-bold',
              variante === 'oscuro' ? 'text-sky-300' : 'text-slate-500 dark:text-slate-400',
            ].join(' ')}
          >
            TM
          </span>
        </div>
        <span
          className={[
            'mt-1 font-medium',
            escala.slogan,
            variante === 'oscuro' ? 'text-sky-200' : 'text-slate-600 dark:text-slate-300',
          ].join(' ')}
        >
          {t('app.eslogan')}
        </span>
      </div>
    </div>
  );
}
