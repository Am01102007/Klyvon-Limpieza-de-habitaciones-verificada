import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ModalProps {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}

export function Modal({ abierto, titulo, alCerrar, children }: ModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!abierto) {
      return;
    }
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        alCerrar();
      }
    };
    window.addEventListener('keydown', manejarTecla);
    return () => {
      window.removeEventListener('keydown', manejarTecla);
    };
  }, [abierto, alCerrar]);

  if (!abierto) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2
            id="modal-titulo"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label={t('comun.cerrar')}
            className="flex min-h-[48px] min-w-[48px] cursor-pointer items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
