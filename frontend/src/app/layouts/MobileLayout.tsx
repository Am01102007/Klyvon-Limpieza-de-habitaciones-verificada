import { ClipboardList, UserCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { type Idioma } from '@/api/esquemas';
import { ModalAvisoPrivacidadEmpleado } from '@/components/AvisoPrivacidad';
import { ControlesAccesibilidad } from '@/components/ControlesAccesibilidad';
import { LogoKlyvon } from '@/components/LogoKlyvon';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';
import { SelectorIdioma } from '@/components/SelectorIdioma';
import { useCambiarIdioma } from '@/features/auth/hooks';
import { cambiarIdiomaInterfaz } from '@/i18n';

import { useAuth } from '../AuthProvider';

export interface ItemNavMovil {
  ruta: string;
  etiqueta: string;
  icono: typeof ClipboardList;
  exacto?: boolean;
}

export interface MobileLayoutProps {
  itemsNav?: ItemNavMovil[];
}

export function MobileLayout({ itemsNav }: MobileLayoutProps) {
  const { t, i18n } = useTranslation();
  const { usuario, sinConexion } = useAuth();
  const cambiarIdiomaMutation = useCambiarIdioma();

  const navegacion: ItemNavMovil[] = itemsNav ?? [
    {
      ruta: '/empleado',
      etiqueta: t('nav.mis_tareas'),
      icono: ClipboardList,
      exacto: true,
    },
    {
      ruta: '/perfil',
      etiqueta: t('nav.perfil'),
      icono: UserCircle2,
    },
  ];

  const manejarIdioma = (nuevoIdioma: Idioma) => {
    cambiarIdiomaInterfaz(nuevoIdioma);
    if (usuario) {
      cambiarIdiomaMutation.mutate(nuevoIdioma);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-16 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="mx-auto flex max-w-2xl flex-col px-4 pt-2 pb-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-2">
              <ControlesAccesibilidad
                compacto
                idiomaActual={usuario?.idioma ?? i18n.language}
                alCambiarIdioma={manejarIdioma}
                cambiandoIdioma={cambiarIdiomaMutation.isPending}
              />
              {usuario && (
                <span className="hidden truncate text-xs font-medium whitespace-nowrap text-slate-600 sm:inline dark:text-slate-300">
                  {usuario.nombre_usuario} · {t(`roles.${usuario.rol}`)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PWAInstallButton compacto />
              <SelectorIdioma
                idiomaActual={usuario?.idioma ?? i18n.language}
                alCambiar={manejarIdioma}
                deshabilitado={cambiarIdiomaMutation.isPending}
                variante="claro"
              />
            </div>
          </div>

          <div className="flex items-center justify-center pt-2">
            <LogoKlyvon tamano="mediano" />
          </div>
        </div>
      </header>

      <OfflineIndicator />
      {sinConexion && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-3">
          <NotificacionEstado tipo="info" mensaje={t('offline.modo_sin_conexion')} />
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <Outlet />
      </main>

      <ModalAvisoPrivacidadEmpleado />

      <nav
        aria-label={t('nav.menu')}
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mx-auto flex max-w-2xl items-stretch">
          {navegacion.map((item) => {
            const Icono = item.icono;
            return (
              <NavLink
                key={item.ruta}
                to={item.ruta}
                end={item.exacto}
                className={({ isActive }) =>
                  [
                    'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 px-2 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'border-primario-500 text-primario-600 dark:text-sky-400'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                  ].join(' ')
                }
              >
                <Icono className="h-5 w-5" aria-hidden="true" />
                <span>{item.etiqueta}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
