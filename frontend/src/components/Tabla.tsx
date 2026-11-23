import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ColumnaTabla<T> {
  clave: string;
  encabezado: string;
  alineacion?: 'izquierda' | 'derecha';
  render: (fila: T) => ReactNode;
}

export interface TablaProps<T> {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  obtenerClave: (fila: T) => string;
  tituloAccesible: string;
}

export function Tabla<T>({ columnas, filas, obtenerClave, tituloAccesible }: TablaProps<T>) {
  const { t } = useTranslation();

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {t('comun.sin_resultados')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full border-collapse text-left text-sm" aria-label={tituloAccesible}>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200">
          <tr>
            {columnas.map((col) => (
              <th
                key={col.clave}
                scope="col"
                className={`px-4 py-3 ${col.alineacion === 'derecha' ? 'text-right' : 'text-left'}`}
              >
                {col.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {filas.map((fila) => (
            <tr key={obtenerClave(fila)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columnas.map((col) => (
                <td
                  key={col.clave}
                  className={`px-4 py-3 text-slate-800 dark:text-slate-200 ${
                    col.alineacion === 'derecha' ? 'text-right tabular-nums' : 'text-left'
                  }`}
                >
                  {col.render(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
