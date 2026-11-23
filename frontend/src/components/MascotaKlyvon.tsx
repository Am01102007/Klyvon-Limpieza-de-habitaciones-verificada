import { useTranslation } from 'react-i18next';

export interface MascotaKlyvonProps {
  tamano?: 'chico' | 'mediano' | 'grande';
  animada?: boolean;
  className?: string;
}

const TAMANOS: Record<NonNullable<MascotaKlyvonProps['tamano']>, string> = {
  chico: 'h-12 w-12',
  mediano: 'h-20 w-20 sm:h-24 sm:w-24',
  grande: 'h-28 w-28 sm:h-36 sm:w-36',
};

export function MascotaKlyvon({
  tamano = 'mediano',
  animada = true,
  className = '',
}: MascotaKlyvonProps) {
  const { t } = useTranslation();

  return (
    <div
      className={[
        'inline-flex items-center justify-center bg-transparent select-none',
        TAMANOS[tamano],
        animada ? 'klyvon-saludo' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={t('app.mascota_alt')}
    >
      <svg viewBox="0 0 180 180" className="h-full w-full" fill="none" aria-hidden="true">
        {/* Gorra */}
        <path d="M52 50C54 30 70 20 90 20C110 20 126 30 128 50H52Z" fill="#1E3A8A" />
        <path d="M46 50H136C140 50 142 56 135 58H46C42 58 42 50 46 50Z" fill="#1D4ED8" />
        <path d="M84 31L93 31L86 41H81L84 31Z" fill="#38BDF8" />
        {/* Auriculares */}
        <rect x="33" y="72" width="12" height="30" rx="6" fill="#0284C7" />
        <rect x="135" y="72" width="12" height="30" rx="6" fill="#0284C7" />
        {/* Cabeza */}
        <rect
          x="42"
          y="54"
          width="96"
          height="62"
          rx="26"
          className="fill-slate-100 stroke-slate-300 dark:fill-slate-200 dark:stroke-slate-500"
          strokeWidth="3"
        />
        {/* Visor */}
        <rect x="52" y="64" width="76" height="42" rx="16" fill="#0A1938" />
        {/* Ojos felices */}
        <path
          d="M65 82C67 76 75 76 78 82"
          stroke="#38BDF8"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M102 82C105 76 113 76 115 82"
          stroke="#38BDF8"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path d="M82 92C86 96 94 96 98 92" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round" />
        {/* Cuerpo con delantal */}
        <rect
          x="56"
          y="116"
          width="68"
          height="46"
          rx="18"
          className="fill-slate-100 stroke-slate-300 dark:fill-slate-200 dark:stroke-slate-500"
          strokeWidth="3"
        />
        <path
          d="M64 126H116V154C116 159 111 162 106 162H74C69 162 64 159 64 154V126Z"
          fill="#1E3A8A"
        />
        <rect x="78" y="138" width="24" height="16" rx="4" fill="#38BDF8" opacity="0.85" />
        {/* Brazo izquierdo con mopa */}
        <path
          d="M54 126C42 128 36 138 40 148"
          className="stroke-slate-300 dark:stroke-slate-400"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1="34"
          y1="68"
          x2="34"
          y2="164"
          stroke="#64748B"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="16" y="160" width="38" height="10" rx="5" fill="#0EA5E9" />
        {/* Brazo derecho saludando */}
        <g className={animada ? 'klyvon-mano-saludo' : ''}>
          <path
            d="M126 126C138 120 146 108 144 94"
            className="stroke-slate-300 dark:stroke-slate-400"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="144" cy="90" r="8" fill="#0EA5E9" />
        </g>
        {/* Destello */}
        <path d="M148 34L151 42L159 45L151 48L148 56L145 48L137 45L145 42L148 34Z" fill="#38BDF8" />
      </svg>
    </div>
  );
}
