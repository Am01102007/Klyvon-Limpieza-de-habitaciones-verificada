import { useTranslation } from 'react-i18next';

import { Boton } from './Boton';

export interface PaginadorProps {
  desplazamiento: number;
  limite: number;
  total: number;
  alCambiar: (desplazamiento: number) => void;
}

export function Paginador({ desplazamiento, limite, total, alCambiar }: PaginadorProps) {
  const { t } = useTranslation();
  if (total <= limite) {
    return null;
  }
  const desde = desplazamiento + 1;
  const hasta = Math.min(desplazamiento + limite, total);
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={t('comun.paginacion')}>
      <Boton
        variante="secundario"
        disabled={desplazamiento === 0}
        onClick={() => {
          alCambiar(Math.max(0, desplazamiento - limite));
        }}
      >
        {t('comun.anterior')}
      </Boton>
      <span className="text-sm text-slate-600 tabular-nums dark:text-slate-300">
        {t('comun.rango', { desde, hasta, total })}
      </span>
      <Boton
        variante="secundario"
        disabled={hasta >= total}
        onClick={() => {
          alCambiar(desplazamiento + limite);
        }}
      >
        {t('comun.siguiente')}
      </Boton>
    </nav>
  );
}
