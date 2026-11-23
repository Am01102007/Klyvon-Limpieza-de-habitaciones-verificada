import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MinusCircle,
  PlayCircle,
  Send,
  Wrench,
  XCircle,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type TipoInsigniaEstado =
  | 'pendiente'
  | 'en_curso'
  | 'enviada'
  | 'por_revisar'
  | 'aprobada'
  | 'rechazada'
  | 'no_requerida'
  | 'dano_urgente'
  | 'dano_leve'
  | 'dano_abierto'
  | 'dano_en_reparacion'
  | 'dano_resuelto'
  | 'activo'
  | 'inactivo';

interface ConfigEstado {
  clase: string;
  icono: ReactNode;
  claveTexto: string;
}

const CONFIG_ESTADOS: Record<TipoInsigniaEstado, ConfigEstado> = {
  pendiente: {
    clase:
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    icono: <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.pendiente',
  },
  en_curso: {
    clase:
      'bg-primario-50 text-primario-800 border-primario-200 dark:bg-primario-950/70 dark:text-sky-200 dark:border-primario-700',
    icono: <PlayCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.en_curso',
  },
  enviada: {
    clase:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-700',
    icono: <Send className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.enviada',
  },
  por_revisar: {
    clase:
      'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700',
    icono: <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.por_revisar',
  },
  aprobada: {
    clase:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700',
    icono: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.aprobada',
  },
  rechazada: {
    clase:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-700',
    icono: <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.rechazada',
  },
  no_requerida: {
    clase:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icono: <MinusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.no_requerida',
  },
  dano_urgente: {
    clase:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-700',
    icono: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.dano_urgente',
  },
  dano_leve: {
    clase:
      'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700',
    icono: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.dano_leve',
  },
  dano_abierto: {
    clase:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-700',
    icono: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.dano_abierto',
  },
  dano_en_reparacion: {
    clase:
      'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700',
    icono: <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.dano_en_reparacion',
  },
  dano_resuelto: {
    clase:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700',
    icono: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.dano_resuelto',
  },
  activo: {
    clase:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700',
    icono: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.activo',
  },
  inactivo: {
    clase:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    icono: <MinusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    claveTexto: 'estados.inactivo',
  },
};

export interface InsigniaEstadoProps {
  estado: TipoInsigniaEstado;
}

export function InsigniaEstado({ estado }: InsigniaEstadoProps) {
  const { t } = useTranslation();
  const cfg = CONFIG_ESTADOS[estado];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cfg.clase}`}
    >
      {cfg.icono}
      <span>{t(cfg.claveTexto)}</span>
    </span>
  );
}
