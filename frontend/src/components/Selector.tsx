import { type SelectHTMLAttributes, useId } from 'react';

export interface OpcionSelector {
  valor: string;
  texto: string;
}

export interface SelectorProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  etiqueta: string;
  opciones: OpcionSelector[];
  /** Primera opción con valor vacío ("Todas", "Selecciona…"). */
  opcionVacia?: string;
}

export function Selector({ etiqueta, opciones, opcionVacia, id, ...resto }: SelectorProps) {
  const idGenerado = useId();
  const idSelect = id ?? idGenerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idSelect} className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {etiqueta}
      </label>
      <select
        id={idSelect}
        className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
        {...resto}
      >
        {opcionVacia !== undefined && <option value="">{opcionVacia}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
