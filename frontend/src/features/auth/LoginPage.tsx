import { Camera, CheckCircle2, Clock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { type Idioma, LoginEntradaSchema } from '@/api/esquemas';
import { rutaInicialPorRol, useAuth } from '@/app/AuthProvider';
import { Boton } from '@/components/Boton';
import { Campo } from '@/components/Campo';
import { ControlesAccesibilidad } from '@/components/ControlesAccesibilidad';
import { traducirError } from '@/components/ErrorPantalla';
import { LogoKlyvon } from '@/components/LogoKlyvon';
import { MascotaKlyvon } from '@/components/MascotaKlyvon';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';
import { SelectorIdioma } from '@/components/SelectorIdioma';
import { cambiarIdiomaInterfaz } from '@/i18n';
import { obtenerCodigoEmpresaGuardado } from '@/utils/storage';

import { useLogin } from './hooks';

interface ErroresCampoLogin {
  codigo_empresa?: string;
  nombre_usuario?: string;
  clave?: string;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { usuario, motivoCierre, limpiarMotivoCierre } = useAuth();
  const loginMutation = useLogin();

  const [codigoEmpresa, setCodigoEmpresa] = useState(() => obtenerCodigoEmpresaGuardado());
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [erroresCampo, setErroresCampo] = useState<ErroresCampoLogin>({});

  if (usuario) {
    return <Navigate to={rutaInicialPorRol(usuario.rol)} replace />;
  }

  const manejarIdioma = (nuevoIdioma: Idioma) => {
    cambiarIdiomaInterfaz(nuevoIdioma);
  };

  const manejarEnvio = (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMotivoCierre();

    const validacion = LoginEntradaSchema.safeParse({
      codigo_empresa: codigoEmpresa.trim().toUpperCase(),
      nombre_usuario: nombreUsuario.trim(),
      clave,
    });

    if (!validacion.success) {
      const nuevosErrores: ErroresCampoLogin = {};
      for (const issue of validacion.error.issues) {
        const campo = issue.path[0];
        if (campo === 'codigo_empresa') {
          nuevosErrores.codigo_empresa = t('auth.validacion.codigo_empresa_requerido');
        } else if (campo === 'nombre_usuario') {
          nuevosErrores.nombre_usuario = t('auth.validacion.nombre_usuario_requerido');
        } else if (campo === 'clave') {
          nuevosErrores.clave = t('auth.validacion.clave_requerida');
        }
      }
      setErroresCampo(nuevosErrores);
      return;
    }

    setErroresCampo({});
    loginMutation.mutate(validacion.data);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ControlesAccesibilidad idiomaActual={i18n.language} alCambiarIdioma={manejarIdioma} />
            <PWAInstallButton compacto />
          </div>
          <SelectorIdioma idiomaActual={i18n.language} alCambiar={manejarIdioma} variante="claro" />
        </header>

        <div className="my-5 flex justify-center">
          <LogoKlyvon tamano="grande" />
        </div>

        <div className="my-auto grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-12">
          <div className="klyvon-canvas-claro flex flex-col justify-between gap-6 border-b border-slate-200 p-6 sm:p-8 lg:col-span-6 lg:border-r lg:border-b-0 dark:border-slate-800">
            <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
              <div className="flex items-center justify-center rounded-2xl border border-primario-100 bg-white/75 px-5 py-3 shadow-xs dark:border-slate-700 dark:bg-slate-900/70">
                <MascotaKlyvon tamano="grande" animada />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  {t('auth.hero_titulo')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('auth.hero_subtitulo')}
                </p>
              </div>
            </div>

            <ul className="grid gap-2.5 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
                <Camera
                  className="h-4 w-4 shrink-0 text-primario-600 dark:text-sky-400"
                  aria-hidden="true"
                />
                <span>{t('auth.pilar_evidencia')}</span>
              </li>
              <li className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
                <Clock
                  className="h-4 w-4 shrink-0 text-primario-600 dark:text-sky-400"
                  aria-hidden="true"
                />
                <span>{t('auth.pilar_tiempos')}</span>
              </li>
              <li className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-primario-600 dark:text-sky-400"
                  aria-hidden="true"
                />
                <span>{t('auth.pilar_revision')}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-6">
            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primario-600 dark:text-sky-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{t('app.eslogan')}</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('auth.titulo_login')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t('auth.subtitulo_login')}
              </p>
            </div>

            {motivoCierre === 'inactividad' && (
              <div className="mb-4">
                <NotificacionEstado tipo="info" mensaje={t('auth.sesion_expirada_inactividad')} />
              </div>
            )}

            {loginMutation.isError && (
              <div className="mb-4">
                <NotificacionEstado tipo="error" mensaje={traducirError(loginMutation.error, t)} />
              </div>
            )}

            <form onSubmit={manejarEnvio} className="flex flex-col gap-4" noValidate>
              <Campo
                etiqueta={t('auth.codigo_empresa')}
                placeholder={t('auth.codigo_empresa_placeholder')}
                value={codigoEmpresa}
                onChange={(e) => {
                  setCodigoEmpresa(e.target.value.toUpperCase());
                }}
                autoComplete="organization"
                autoCapitalize="characters"
                maxLength={20}
                error={erroresCampo.codigo_empresa}
              />

              <Campo
                etiqueta={t('auth.nombre_usuario')}
                placeholder={t('auth.nombre_usuario_placeholder')}
                value={nombreUsuario}
                onChange={(e) => {
                  setNombreUsuario(e.target.value);
                }}
                autoComplete="username"
                maxLength={60}
                error={erroresCampo.nombre_usuario}
              />

              <Campo
                etiqueta={t('auth.clave')}
                placeholder={t('auth.clave_placeholder')}
                type={mostrarClave ? 'text' : 'password'}
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                }}
                autoComplete="current-password"
                maxLength={128}
                error={erroresCampo.clave}
                accionDerecha={
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarClave((prev) => !prev);
                    }}
                    aria-label={mostrarClave ? t('auth.ocultar_clave') : t('auth.mostrar_clave')}
                    className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {mostrarClave ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                }
              />

              <div className="pt-2">
                <Boton
                  type="submit"
                  variante="primario"
                  anchoCompleto
                  cargando={loginMutation.isPending}
                >
                  {loginMutation.isPending ? t('auth.entrando') : t('auth.entrar')}
                </Boton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
