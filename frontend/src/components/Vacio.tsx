import { Inbox } from 'lucide-react';
import { type ReactNode } from 'react';

export interface VacioProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export function Vacio({ titulo, descripcion, accion }: VacioProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
      {descripcion && (
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{descripcion}</p>
      )}
      {accion && <div className="mt-1">{accion}</div>}
    </div>
  );
}
