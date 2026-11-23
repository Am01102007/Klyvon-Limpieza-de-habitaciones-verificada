import { type TFunction } from 'i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorApi } from '@/api/cliente';

import { Boton } from './Boton';

export function traducirError(error: unknown, t: TFunction): string {
  if (error instanceof ErrorApi) {
    const clave = `errores.${error.codigo}`;
    const traducido = t(clave);
    return traducido === clave ? t('errores.desconocido') : traducido;
  }
  return t('errores.desconocido');
}

export interface ErrorPantallaProps {
  error: unknown;
  alReintentar?: () => void;
}

export function ErrorPantalla({ error, alReintentar }: ErrorPantallaProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center dark:border-red-800 dark:bg-red-950/50"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-300">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="max-w-md text-sm font-semibold text-red-900 dark:text-red-200">
        {traducirError(error, t)}
      </p>
      {alReintentar && (
        <Boton
          variante="secundario"
          icono={<RefreshCw className="h-4 w-4" />}
          onClick={alReintentar}
        >
          {t('comun.reintentar')}
        </Boton>
      )}
    </div>
  );
}
