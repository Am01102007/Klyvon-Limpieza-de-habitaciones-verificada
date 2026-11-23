import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/app/AuthProvider';
import { avisoPrivacidadVisto, marcarAvisoPrivacidadVisto } from '@/utils/storage';

import { Boton } from './Boton';
import { Modal } from './Modal';

const SECCIONES = [
  'registra',
  'no_registra',
  'para_que',
  'quien',
  'cuanto',
  'fotos',
  'preguntas',
] as const;

/** RNF-07: qué datos guarda la app del empleado y por cuánto tiempo. */
export function TextoAvisoPrivacidad() {
  const { t } = useTranslation();
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {SECCIONES.map((seccion) => (
        <div key={seccion}>
          <dt className="font-semibold text-slate-900 dark:text-white">
            {t(`privacidad.${seccion}_titulo`)}
          </dt>
          <dd className="mt-0.5 text-slate-700 dark:text-slate-300">
            {t(`privacidad.${seccion}_texto`)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Se muestra una vez a cada empleado en este teléfono, antes de empezar a trabajar. */
export function ModalAvisoPrivacidadEmpleado() {
  const { t } = useTranslation();
  const { usuario } = useAuth();
  const [visto, setVisto] = useState(() => (usuario ? avisoPrivacidadVisto(usuario.id) : true));

  if (!usuario || usuario.rol !== 'empleado' || visto) {
    return null;
  }

  const aceptar = () => {
    marcarAvisoPrivacidadVisto(usuario.id);
    setVisto(true);
  };

  return (
    <Modal abierto titulo={t('privacidad.titulo')} alCerrar={aceptar}>
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <ShieldCheck
            className="h-5 w-5 shrink-0 text-primario-600 dark:text-sky-400"
            aria-hidden="true"
          />
          {t('privacidad.introduccion')}
        </p>
        <TextoAvisoPrivacidad />
        <Boton variante="primario" anchoCompleto onClick={aceptar}>
          {t('privacidad.entendido')}
        </Boton>
      </div>
    </Modal>
  );
}
