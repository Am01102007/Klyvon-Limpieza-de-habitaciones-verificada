import { Camera, Check, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Boton } from '@/components/Boton';
import { NotificacionEstado } from '@/components/NotificacionEstado';

import { capturarFrameVideoComprimido } from './camara';

export interface CamaraEnVivoProps {
  alCapturar: (blob: Blob) => Promise<void> | void;
  alCancelar: () => void;
  procesandoExterno?: boolean;
}

type EstadoCamara = 'iniciando' | 'lista' | 'previa' | 'error';

export function CamaraEnVivo({
  alCapturar,
  alCancelar,
  procesandoExterno = false,
}: CamaraEnVivoProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [estado, setEstado] = useState<EstadoCamara>('iniciando');
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [blobCapturado, setBlobCapturado] = useState<Blob | null>(null);
  const [urlPrevia, setUrlPrevia] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);

  const detenerStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
  }, []);

  const iniciarCamara = useCallback(async () => {
    detenerStream();
    setEstado('iniciando');
    setMensajeError(null);

    // Sin HTTPS (o localhost) el navegador no expone la cámara.
    if (!('mediaDevices' in navigator)) {
      setEstado('error');
      setMensajeError(t('camara.error_no_disponible'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setEstado('lista');
    } catch {
      setEstado('error');
      setMensajeError(t('camara.error_permiso'));
    }
  }, [detenerStream, t]);

  useEffect(() => {
    // Enciende la cámara (sistema externo) al montar y la apaga al desmontar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void iniciarCamara();
    return () => {
      detenerStream();
    };
  }, [iniciarCamara, detenerStream]);

  useEffect(() => {
    if (estado === 'lista' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [estado]);

  useEffect(() => {
    return () => {
      if (urlPrevia) {
        URL.revokeObjectURL(urlPrevia);
      }
    };
  }, [urlPrevia]);

  const manejarCapturar = async () => {
    if (!videoRef.current) {
      return;
    }
    setComprimiendo(true);
    try {
      const blob = await capturarFrameVideoComprimido(videoRef.current);
      if (urlPrevia) {
        URL.revokeObjectURL(urlPrevia);
      }
      const nuevaUrl = URL.createObjectURL(blob);
      setBlobCapturado(blob);
      setUrlPrevia(nuevaUrl);
      detenerStream();
      setEstado('previa');
    } catch {
      setMensajeError(t('camara.error_no_disponible'));
      setEstado('error');
    } finally {
      setComprimiendo(false);
    }
  };

  const manejarRetomar = () => {
    if (urlPrevia) {
      URL.revokeObjectURL(urlPrevia);
    }
    setUrlPrevia(null);
    setBlobCapturado(null);
    void iniciarCamara();
  };

  const manejarUsarFoto = async () => {
    if (!blobCapturado) {
      return;
    }
    await alCapturar(blobCapturado);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white dark:border-slate-700">
      {estado === 'error' && mensajeError && (
        <div className="flex flex-col gap-3">
          <NotificacionEstado tipo="error" mensaje={mensajeError} />
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              icono={<RefreshCw className="h-4 w-4" />}
              onClick={() => {
                void iniciarCamara();
              }}
            >
              {t('comun.reintentar')}
            </Boton>
            <Boton
              variante="fantasma"
              className="text-white hover:bg-slate-800"
              onClick={alCancelar}
            >
              {t('camara.cancelar')}
            </Boton>
          </div>
        </div>
      )}

      {estado === 'iniciando' && (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-300">
          {t('camara.iniciando')}
        </div>
      )}

      {estado === 'lista' && (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-4/3 w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="primario"
              anchoCompleto
              cargando={comprimiendo}
              icono={<Camera className="h-5 w-5" />}
              onClick={() => {
                void manejarCapturar();
              }}
            >
              {comprimiendo ? t('camara.comprimiendo') : t('camara.capturar')}
            </Boton>
            <Boton
              variante="secundario"
              anchoCompleto
              icono={<X className="h-4 w-4" />}
              onClick={alCancelar}
            >
              {t('camara.cancelar')}
            </Boton>
          </div>
        </>
      )}

      {estado === 'previa' && urlPrevia && (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            <img
              src={urlPrevia}
              alt={t('camara.vista_previa_alt')}
              className="aspect-4/3 w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="primario"
              anchoCompleto
              cargando={procesandoExterno}
              icono={<Check className="h-5 w-5" />}
              onClick={() => {
                void manejarUsarFoto();
              }}
            >
              {procesandoExterno ? t('camara.subiendo') : t('camara.usar_foto')}
            </Boton>
            <Boton
              variante="secundario"
              anchoCompleto
              disabled={procesandoExterno}
              icono={<RotateCcw className="h-4 w-4" />}
              onClick={manejarRetomar}
            >
              {t('camara.retomar')}
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
