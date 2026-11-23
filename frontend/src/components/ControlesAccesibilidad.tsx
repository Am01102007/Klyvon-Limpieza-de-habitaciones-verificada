import { Accessibility, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Idioma } from '@/api/esquemas';
import { usePreferencias } from '@/app/PreferenciasProvider';

import { Modal } from './Modal';
import { PanelAccesibilidad } from './PanelAccesibilidad';
import { SelectorIdioma } from './SelectorIdioma';

export interface ControlesAccesibilidadProps {
  compacto?: boolean;
  idiomaActual?: string;
  alCambiarIdioma?: (idioma: Idioma) => void;
  cambiandoIdioma?: boolean;
}

export function ControlesAccesibilidad({
  compacto = false,
  idiomaActual,
  alCambiarIdioma,
  cambiandoIdioma = false,
}: ControlesAccesibilidadProps) {
  const { t } = useTranslation();
  const { tema, alternarTema } = usePreferencias();
  const [modalAbierto, setModalAbierto] = useState(false);

  const esOscuro = tema === 'oscuro';
  const etiquetaTema = esOscuro
    ? t('accesibilidad.cambiar_a_claro')
    : t('accesibilidad.cambiar_a_oscuro');

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={alternarTema}
          aria-label={etiquetaTema}
          title={etiquetaTema}
          className="inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {esOscuro ? (
            <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 text-primario-600" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setModalAbierto(true);
          }}
          aria-label={t('accesibilidad.boton')}
          title={t('accesibilidad.titulo')}
          className="inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Accessibility
            className="h-4 w-4 text-primario-600 dark:text-sky-400"
            aria-hidden="true"
          />
          {!compacto && <span>{t('accesibilidad.boton')}</span>}
        </button>
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={t('accesibilidad.titulo')}
        alCerrar={() => {
          setModalAbierto(false);
        }}
      >
        <div className="flex flex-col gap-5">
          {alCambiarIdioma && idiomaActual && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('accesibilidad.idioma_rapido')}
              </span>
              <SelectorIdioma
                idiomaActual={idiomaActual}
                alCambiar={alCambiarIdioma}
                deshabilitado={cambiandoIdioma}
                variante="claro"
              />
            </div>
          )}
          <PanelAccesibilidad />
        </div>
      </Modal>
    </>
  );
}
