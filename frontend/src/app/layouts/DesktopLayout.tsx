import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckSquare,
  Menu,
  Settings,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { type Idioma } from '@/api/esquemas';
import { ControlesAccesibilidad } from '@/components/ControlesAccesibilidad';
import { LogoKlyvon } from '@/components/LogoKlyvon';
import { MascotaKlyvon } from '@/components/MascotaKlyvon';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';
import { SelectorIdioma } from '@/components/SelectorIdioma';
import { useCambiarIdioma } from '@/features/auth/hooks';
import { cambiarIdiomaInterfaz } from '@/i18n';

import { useAuth } from '../AuthProvider';

export function DesktopLayout() {
  const { t, i18n } = useTranslation();
  const { usuario } = useAuth();
  const cambiarIdiomaMutation = useCambiarIdioma();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const manejarIdioma = (nuevoIdioma: Idioma) => {
    cambiarIdiomaInterfaz(nuevoIdioma);
    if (usuario) {
      cambiarIdiomaMutation.mutate(nuevoIdioma);
    }
  };

  const baseRuta = usuario?.rol === 'supervisor' ? '/supervisor' : '/admin';

  const enlaces = [
    { to: baseRuta, label: t('nav.revisiones'), icono: CheckSquare, end: true },
    { to: `${baseRuta}/asignaciones`, label: t('nav.asignaciones'), icono: CalendarClock },
    { to: `${baseRuta}/danos`, label: t('nav.danos'), icono: AlertTriangle },
    { to: `${baseRuta}/reportes`, label: t('nav.reportes'), icono: BarChart3 },
    ...(usuario?.rol === 'admin'
      ? [
          { to: '/admin/usuarios', label: t('nav.usuarios'), icono: Users },
          { to: '/admin/propiedades', label: t('nav.propiedades'), icono: Building2 },
          { to: '/admin/empresa', label: t('nav.empresa'), icono: Settings },
        ]
      : [{ to: '/supervisor/empleados', label: t('nav.empleados'), icono: Users }]),
    { to: '/perfil', label: t('nav.perfil'), icono: UserCircle2 },
  ];

  const contenidoNav = (
    <nav aria-label={t('nav.menu')} className="flex flex-col gap-1 p-3">
      {enlaces.map((item) => {
        const Icono = item.icono;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => {
              setMenuAbierto(false);
            }}
            className={({ isActive }) =>
              [
                'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primario-50 text-primario-700 dark:bg-primario-500/20 dark:text-sky-300'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
              ].join(' ')
            }
          >
            <Icono className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
        <div className="flex h-20 items-center justify-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800">
          <MascotaKlyvon tamano="chico" animada className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {t('app.nombre')}
            </p>
            <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">
              {t('app.eslogan')}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{contenidoNav}</div>
        {usuario && (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <div className="klyvon-canvas-claro rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {usuario.nombre_usuario}
              </p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                {t(`roles.${usuario.rol}`)}
              </p>
            </div>
          </div>
        )}
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label={t('nav.cerrar_menu')}
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => {
              setMenuAbierto(false);
            }}
          />
          <aside className="relative z-50 flex w-64 flex-col bg-white shadow-xl dark:bg-slate-900">
            <div className="flex h-20 items-center justify-between gap-2 border-b border-slate-200 px-4 text-slate-900 dark:border-slate-800 dark:text-white">
              <div className="flex min-w-0 items-center gap-2">
                <MascotaKlyvon tamano="chico" animada className="shrink-0" />
                <span className="truncate text-sm font-bold">{t('app.nombre')}</span>
              </div>
              <button
                type="button"
                aria-label={t('nav.cerrar_menu')}
                onClick={() => {
                  setMenuAbierto(false);
                }}
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{contenidoNav}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="flex items-center gap-3 justify-self-start">
            <button
              type="button"
              aria-label={t('nav.menu')}
              onClick={() => {
                setMenuAbierto(true);
              }}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            {usuario && (
              <span className="hidden text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 lg:inline">
                {usuario.nombre_usuario} · {t(`roles.${usuario.rol}`)}
              </span>
            )}
          </div>

          <div className="justify-self-center">
            <LogoKlyvon tamano="mediano" />
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <PWAInstallButton compacto />
            <ControlesAccesibilidad
              compacto
              idiomaActual={usuario?.idioma ?? i18n.language}
              alCambiarIdioma={manejarIdioma}
              cambiandoIdioma={cambiarIdiomaMutation.isPending}
            />
            <div className="hidden sm:block">
              <SelectorIdioma
                idiomaActual={usuario?.idioma ?? i18n.language}
                alCambiar={manejarIdioma}
                deshabilitado={cambiarIdiomaMutation.isPending}
                variante="claro"
              />
            </div>
          </div>
        </header>

        <OfflineIndicator />

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
