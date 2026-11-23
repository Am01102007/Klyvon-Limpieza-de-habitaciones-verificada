import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectarModoStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const matchMediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(matchMediaStandalone || nav.standalone);
}

function detectarIOS(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePWAInstall() {
  const [eventoInstalacion, setEventoInstalacion] = useState<BeforeInstallPromptEvent | null>(null);
  const [yaInstalada, setYaInstalada] = useState<boolean>(() => detectarModoStandalone());
  const [mostrarInstruccionesIOS, setMostrarInstruccionesIOS] = useState(false);

  const esIOS = detectarIOS();

  useEffect(() => {
    const alRecibirPrompt = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacion(evento as BeforeInstallPromptEvent);
    };
    const alInstalar = () => {
      setYaInstalada(true);
      setEventoInstalacion(null);
      setMostrarInstruccionesIOS(false);
    };

    window.addEventListener('beforeinstallprompt', alRecibirPrompt);
    window.addEventListener('appinstalled', alInstalar);

    return () => {
      window.removeEventListener('beforeinstallprompt', alRecibirPrompt);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const puedeInstalar = !yaInstalada && (eventoInstalacion !== null || esIOS);

  const iniciarInstalacion = useCallback(async () => {
    if (eventoInstalacion) {
      await eventoInstalacion.prompt();
      const { outcome } = await eventoInstalacion.userChoice;
      if (outcome === 'accepted') {
        setYaInstalada(true);
      }
      setEventoInstalacion(null);
      return;
    }
    if (esIOS) {
      setMostrarInstruccionesIOS(true);
    }
  }, [eventoInstalacion, esIOS]);

  const cerrarInstruccionesIOS = useCallback(() => {
    setMostrarInstruccionesIOS(false);
  }, []);

  return {
    puedeInstalar,
    yaInstalada,
    esIOS,
    mostrarInstruccionesIOS,
    iniciarInstalacion,
    cerrarInstruccionesIOS,
  };
}
