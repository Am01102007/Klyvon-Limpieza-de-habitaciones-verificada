import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { cerrarSesion, intentarRecuperarSesion } from '@/api/auth';
import {
  establecerTokenMemoria,
  suscribirExpiracionSesion,
  suscribirRenovacionSesion,
} from '@/api/cliente';
import { type Rol, type SesionSalida, type Usuario } from '@/api/esquemas';
import { Cargando } from '@/components/Cargando';
import { cambiarIdiomaInterfaz } from '@/i18n';
import { esErrorDeRed, establecerUsuarioCola } from '@/offline/colaSync';
import {
  obtenerEmpleadoRecordado,
  olvidarEmpleado,
  recordarEmpleado,
} from '@/offline/sesionSinConexion';
import { hayCierrePendiente, marcarCierrePendiente } from '@/utils/storage';

const TIEMPO_INACTIVIDAD_MS = 15 * 60 * 1000;

export type MotivoCierreSesion = 'inactividad' | null;

export interface ContextoAuth {
  usuario: Usuario | null;
  /** Abierta sin señal como el último empleado; se valida con el servidor al volver la red. */
  sinConexion: boolean;
  cargandoInicial: boolean;
  motivoCierre: MotivoCierreSesion;
  establecerSesion: (sesion: SesionSalida) => void;
  actualizarUsuario: (usuario: Usuario) => void;
  cerrarSesionActual: (motivo?: MotivoCierreSesion) => Promise<void>;
  limpiarMotivoCierre: () => void;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function rutaInicialPorRol(rol: Rol): string {
  switch (rol) {
    case 'empleado':
      return '/empleado';
    case 'supervisor':
      return '/supervisor';
    case 'admin':
      return '/admin';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [usuario, setUsuarioEstado] = useState<Usuario | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  // La cola sin conexión se asocia al usuario de forma síncrona, antes de que monten las vistas.
  // Con una sesión validada por el servidor, se recuerda al empleado para abrir sin señal.
  const setUsuario = useCallback((nuevo: Usuario | null, validadoPorServidor = true) => {
    establecerUsuarioCola(nuevo?.id ?? null);
    setUsuarioEstado(nuevo);
    setSinConexion(nuevo !== null && !validadoPorServidor);
    if (nuevo && validadoPorServidor) {
      void recordarEmpleado(nuevo);
    }
  }, []);
  const cerrarYOlvidar = useCallback(() => {
    void olvidarEmpleado();
    setUsuario(null);
  }, [setUsuario]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [motivoCierre, setMotivoCierre] = useState<MotivoCierreSesion>(null);
  const temporizadorRef = useRef<number | null>(null);

  const sincronizarIdioma = useCallback((nuevoUsuario: Usuario | null) => {
    if (nuevoUsuario) {
      cambiarIdiomaInterfaz(nuevoUsuario.idioma);
    }
  }, []);

  const establecerSesion = useCallback(
    (sesion: SesionSalida) => {
      establecerTokenMemoria(sesion.access_token);
      setUsuario(sesion.usuario);
      setMotivoCierre(null);
      sincronizarIdioma(sesion.usuario);
    },
    [sincronizarIdioma, setUsuario],
  );

  const actualizarUsuario = useCallback(
    (nuevoUsuario: Usuario) => {
      setUsuario(nuevoUsuario);
      sincronizarIdioma(nuevoUsuario);
    },
    [sincronizarIdioma, setUsuario],
  );

  const cerrarSesionActual = useCallback(
    async (motivo: MotivoCierreSesion = null) => {
      try {
        await cerrarSesion();
        marcarCierrePendiente(false);
      } catch (error) {
        // Sin señal la cookie sigue viva en el servidor: se cierra al volver la red.
        if (esErrorDeRed(error)) {
          marcarCierrePendiente(true);
        }
      } finally {
        cerrarYOlvidar();
        setMotivoCierre(motivo);
        // No se borra la cola sin conexión: se envía cuando esta persona vuelva a entrar.
        queryClient.clear();
      }
    },
    [queryClient, cerrarYOlvidar],
  );

  const limpiarMotivoCierre = useCallback(() => {
    setMotivoCierre(null);
  }, []);

  // Recuperar sesión al arrancar con POST /auth/refresh
  useEffect(() => {
    let activo = true;
    if (hayCierrePendiente()) {
      // La persona cerró sesión sin señal: se termina ese cierre y no se recupera la sesión.
      void olvidarEmpleado();
      cerrarSesion()
        .then(() => {
          marcarCierrePendiente(false);
        })
        .catch(() => {
          // Se reintenta en el próximo arranque con red.
        })
        .finally(() => {
          if (activo) {
            setCargandoInicial(false);
          }
        });
      return () => {
        activo = false;
      };
    }
    intentarRecuperarSesion()
      .then((sesion) => {
        if (!activo) {
          return;
        }
        if (sesion) {
          establecerTokenMemoria(sesion.access_token);
          setUsuario(sesion.usuario);
          sincronizarIdioma(sesion.usuario);
        } else {
          cerrarYOlvidar();
        }
      })
      .catch(async (error: unknown) => {
        // Sin señal: abre como el último empleado, si lo hay y sigue vigente.
        const recordado = esErrorDeRed(error) ? await obtenerEmpleadoRecordado() : null;
        if (activo) {
          setUsuario(recordado, false);
          sincronizarIdioma(recordado);
        }
      })
      .finally(() => {
        if (activo) {
          setCargandoInicial(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [sincronizarIdioma, setUsuario, cerrarYOlvidar]);

  // En modo sin señal, al volver la red se valida la sesión con la cookie.
  useEffect(() => {
    if (!sinConexion) {
      return;
    }
    const alConectar = () => {
      intentarRecuperarSesion()
        .then((sesion) => {
          if (sesion) {
            establecerTokenMemoria(sesion.access_token);
            setUsuario(sesion.usuario);
          } else {
            cerrarYOlvidar();
            queryClient.clear();
          }
        })
        .catch(() => {
          // Sigue sin red: se intenta en el próximo evento "online".
        });
    };
    window.addEventListener('online', alConectar);
    if (navigator.onLine) {
      alConectar();
    }
    return () => {
      window.removeEventListener('online', alConectar);
    };
  }, [sinConexion, setUsuario, cerrarYOlvidar, queryClient]);

  // Escuchar expiración y renovación desde cliente HTTP / otras pestañas
  useEffect(() => {
    const desuscribirExpiracion = suscribirExpiracionSesion(() => {
      cerrarYOlvidar();
      queryClient.clear();
    });
    const desuscribirRenovacion = suscribirRenovacionSesion((sesion) => {
      setUsuario(sesion.usuario);
      sincronizarIdioma(sesion.usuario);
    });
    return () => {
      desuscribirExpiracion();
      desuscribirRenovacion();
    };
  }, [queryClient, sincronizarIdioma, setUsuario, cerrarYOlvidar]);

  // Cierre automático por 15 minutos de inactividad
  useEffect(() => {
    if (!usuario) {
      if (temporizadorRef.current !== null) {
        window.clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
      }
      return;
    }

    const reiniciarTemporizador = () => {
      if (temporizadorRef.current !== null) {
        window.clearTimeout(temporizadorRef.current);
      }
      temporizadorRef.current = window.setTimeout(() => {
        void cerrarSesionActual('inactividad');
      }, TIEMPO_INACTIVIDAD_MS);
    };

    reiniciarTemporizador();

    const eventos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    eventos.forEach((ev) => {
      window.addEventListener(ev, reiniciarTemporizador, { passive: true });
    });

    return () => {
      if (temporizadorRef.current !== null) {
        window.clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
      }
      eventos.forEach((ev) => {
        window.removeEventListener(ev, reiniciarTemporizador);
      });
    };
  }, [usuario, cerrarSesionActual]);

  const valor = useMemo<ContextoAuth>(
    () => ({
      usuario,
      sinConexion,
      cargandoInicial,
      motivoCierre,
      establecerSesion,
      actualizarUsuario,
      cerrarSesionActual,
      limpiarMotivoCierre,
    }),
    [
      usuario,
      sinConexion,
      cargandoInicial,
      motivoCierre,
      establecerSesion,
      actualizarUsuario,
      cerrarSesionActual,
      limpiarMotivoCierre,
    ],
  );

  if (cargandoInicial) {
    return <Cargando pantallaCompleta mensaje={t('app.cargando_sesion')} />;
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ContextoAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return ctx;
}
