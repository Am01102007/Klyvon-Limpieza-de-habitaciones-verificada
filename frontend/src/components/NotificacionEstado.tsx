import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface NotificacionEstadoProps {
  tipo: 'error' | 'exito' | 'info';
  mensaje: string;
}

const ESTILOS = {
  error:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200',
  exito:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  info: 'border-primario-200 bg-primario-50 text-primario-900 dark:border-primario-800 dark:bg-primario-950/60 dark:text-sky-200',
};

export function NotificacionEstado({ tipo, mensaje }: NotificacionEstadoProps) {
  const Icono = tipo === 'error' ? AlertCircle : tipo === 'exito' ? CheckCircle2 : Info;

  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm font-medium ${ESTILOS[tipo]}`}
    >
      <Icono className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{mensaje}</span>
    </div>
  );
}
