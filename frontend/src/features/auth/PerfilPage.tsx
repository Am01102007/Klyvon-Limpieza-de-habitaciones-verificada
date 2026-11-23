import { Accessibility, Globe, LogOut, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Idioma } from '@/api/esquemas';
import { useAuth } from '@/app/AuthProvider';
import { TextoAvisoPrivacidad } from '@/components/AvisoPrivacidad';
import { Boton } from '@/components/Boton';
import { traducirError } from '@/components/ErrorPantalla';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { PanelAccesibilidad } from '@/components/PanelAccesibilidad';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';
import { cambiarIdiomaInterfaz } from '@/i18n';

import { useCambiarIdioma, useLogout } from './hooks';

const IDIOMAS: Idioma[] = ['es', 'en', 'pt'];

export function PerfilPage() {
  const { t } = useTranslation();
  const { usuario } = useAuth();
  const cambiarIdiomaMutation = useCambiarIdioma();
  const logoutMutation = useLogout();
  const [idiomaGuardado, setIdiomaGuardado] = useState(false);

  if (!usuario) {
    return null;
  }

  const manejarCambioIdioma = (nuevoIdioma: Idioma) => {
    setIdiomaGuardado(false);
    cambiarIdiomaInterfaz(nuevoIdioma);
    cambiarIdiomaMutation.mutate(nuevoIdioma, {
      onSuccess: () => {
        setIdiomaGuardado(true);
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('perfil.titulo')}</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
          {t('perfil.cuenta')}
        </h2>
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span>{t('perfil.usuario')}</span>
            </dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-white">
              {usuario.nombre_usuario}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Shield className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span>{t('perfil.rol')}</span>
            </dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(`roles.${usuario.rol}`)}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <PWAInstallButton />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <Accessibility
            className="h-5 w-5 text-primario-600 dark:text-sky-400"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('accesibilidad.titulo')}
          </h2>
        </div>

        <PanelAccesibilidad />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primario-600 dark:text-sky-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('perfil.idioma')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {IDIOMAS.map((lang) => {
            const seleccionado = usuario.idioma === lang;
            return (
              <button
                key={lang}
                type="button"
                disabled={cambiarIdiomaMutation.isPending}
                onClick={() => {
                  manejarCambioIdioma(lang);
                }}
                aria-pressed={seleccionado}
                className={[
                  'min-h-[48px] cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                  seleccionado
                    ? 'border-primario-500 bg-primario-50 text-primario-700 dark:bg-primario-500/20 dark:text-sky-200'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                {t(`idiomas.${lang}`)}
              </button>
            );
          })}
        </div>

        {idiomaGuardado && (
          <div className="mt-3">
            <NotificacionEstado tipo="exito" mensaje={t('perfil.idioma_guardado')} />
          </div>
        )}

        {cambiarIdiomaMutation.isError && (
          <div className="mt-3">
            <NotificacionEstado
              tipo="error"
              mensaje={traducirError(cambiarIdiomaMutation.error, t)}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
          {t('privacidad.titulo')}
        </h2>
        <TextoAvisoPrivacidad />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {t('perfil.sesion')}
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-300">
          {t('perfil.ayuda_inactividad')}
        </p>
        <Boton
          variante="peligro"
          anchoCompleto
          cargando={logoutMutation.isPending}
          icono={<LogOut className="h-5 w-5" />}
          onClick={() => {
            logoutMutation.mutate();
          }}
        >
          {t('auth.cerrar_sesion')}
        </Boton>
      </section>
    </div>
  );
}
