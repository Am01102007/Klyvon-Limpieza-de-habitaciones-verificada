import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Boton } from '@/components/Boton';
import { Modal } from '@/components/Modal';

import { usePWAInstall } from './usePWAInstall';

export interface PWAInstallButtonProps {
  compacto?: boolean;
}

export function PWAInstallButton({ compacto = false }: PWAInstallButtonProps) {
  const { t } = useTranslation();
  const { puedeInstalar, mostrarInstruccionesIOS, iniciarInstalacion, cerrarInstruccionesIOS } =
    usePWAInstall();

  if (!puedeInstalar) {
    return null;
  }

  return (
    <>
      {compacto ? (
        <button
          type="button"
          onClick={() => {
            void iniciarInstalacion();
          }}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-primario-200 bg-primario-50 px-3 py-1.5 text-xs font-semibold text-primario-700 transition-colors hover:bg-primario-100 dark:border-primario-700 dark:bg-primario-950/60 dark:text-sky-300 dark:hover:bg-primario-900/70"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('pwa.instalar_boton')}</span>
        </button>
      ) : (
        <Boton
          variante="secundario"
          anchoCompleto
          icono={<Download className="h-5 w-5" />}
          onClick={() => {
            void iniciarInstalacion();
          }}
        >
          {t('pwa.instalar_boton')}
        </Boton>
      )}

      <Modal
        abierto={mostrarInstruccionesIOS}
        titulo={t('pwa.instalar_titulo')}
        alCerrar={cerrarInstruccionesIOS}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">{t('pwa.ios_instrucciones')}</p>
          <Boton variante="primario" anchoCompleto onClick={cerrarInstruccionesIOS}>
            {t('comun.cerrar')}
          </Boton>
        </div>
      </Modal>
    </>
  );
}
