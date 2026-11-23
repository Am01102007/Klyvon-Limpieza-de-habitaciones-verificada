import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  guardarAltoContraste,
  guardarMovimientoReducido,
  guardarTamanoFuente,
  guardarTema,
  obtenerAltoContrasteGuardado,
  obtenerMovimientoReducidoGuardado,
  obtenerTamanoFuenteGuardado,
  obtenerTemaGuardado,
  type TamanoFuente,
  type TemaVisual,
} from '@/utils/storage';

export interface ContextoPreferencias {
  tema: TemaVisual;
  tamanoFuente: TamanoFuente;
  altoContraste: boolean;
  movimientoReducido: boolean;
  alternarTema: () => void;
  establecerTema: (tema: TemaVisual) => void;
  establecerTamanoFuente: (tamano: TamanoFuente) => void;
  establecerAltoContraste: (activo: boolean) => void;
  establecerMovimientoReducido: (activo: boolean) => void;
  restablecerPreferencias: () => void;
}

const PreferenciasContext = createContext<ContextoPreferencias | null>(null);

const CLASES_FUENTE: Record<TamanoFuente, string> = {
  normal: 'klyvon-fuente-normal',
  grande: 'klyvon-fuente-grande',
  muy_grande: 'klyvon-fuente-muy-grande',
};

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<TemaVisual>(() => obtenerTemaGuardado());
  const [tamanoFuente, setTamanoFuente] = useState<TamanoFuente>(() =>
    obtenerTamanoFuenteGuardado(),
  );
  const [altoContraste, setAltoContraste] = useState<boolean>(() => obtenerAltoContrasteGuardado());
  const [movimientoReducido, setMovimientoReducido] = useState<boolean>(() =>
    obtenerMovimientoReducidoGuardado(),
  );

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', tema === 'oscuro');
    html.classList.remove(
      'klyvon-fuente-normal',
      'klyvon-fuente-grande',
      'klyvon-fuente-muy-grande',
    );
    html.classList.add(CLASES_FUENTE[tamanoFuente]);
    html.classList.toggle('klyvon-alto-contraste', altoContraste);
    html.classList.toggle('klyvon-sin-animacion', movimientoReducido);
  }, [tema, tamanoFuente, altoContraste, movimientoReducido]);

  const establecerTema = useCallback((nuevoTema: TemaVisual) => {
    setTema(nuevoTema);
    guardarTema(nuevoTema);
  }, []);

  const alternarTema = useCallback(() => {
    setTema((prev) => {
      const siguiente: TemaVisual = prev === 'oscuro' ? 'claro' : 'oscuro';
      guardarTema(siguiente);
      return siguiente;
    });
  }, []);

  const establecerTamanoFuente = useCallback((nuevoTamano: TamanoFuente) => {
    setTamanoFuente(nuevoTamano);
    guardarTamanoFuente(nuevoTamano);
  }, []);

  const establecerAltoContraste = useCallback((activo: boolean) => {
    setAltoContraste(activo);
    guardarAltoContraste(activo);
  }, []);

  const establecerMovimientoReducido = useCallback((activo: boolean) => {
    setMovimientoReducido(activo);
    guardarMovimientoReducido(activo);
  }, []);

  const restablecerPreferencias = useCallback(() => {
    setTema('claro');
    setTamanoFuente('normal');
    setAltoContraste(false);
    setMovimientoReducido(false);
    guardarTema('claro');
    guardarTamanoFuente('normal');
    guardarAltoContraste(false);
    guardarMovimientoReducido(false);
  }, []);

  const valor = useMemo<ContextoPreferencias>(
    () => ({
      tema,
      tamanoFuente,
      altoContraste,
      movimientoReducido,
      alternarTema,
      establecerTema,
      establecerTamanoFuente,
      establecerAltoContraste,
      establecerMovimientoReducido,
      restablecerPreferencias,
    }),
    [
      tema,
      tamanoFuente,
      altoContraste,
      movimientoReducido,
      alternarTema,
      establecerTema,
      establecerTamanoFuente,
      establecerAltoContraste,
      establecerMovimientoReducido,
      restablecerPreferencias,
    ],
  );

  return <PreferenciasContext.Provider value={valor}>{children}</PreferenciasContext.Provider>;
}

export function usePreferencias(): ContextoPreferencias {
  const ctx = useContext(PreferenciasContext);
  if (!ctx) {
    throw new Error('usePreferencias debe utilizarse dentro de PreferenciasProvider');
  }
  return ctx;
}
