const TAMANO_MAXIMO_BYTES = 500 * 1024;
const DIMENSION_MAXIMA_PX = 1600;
const CALIDADES_JPEG = [0.85, 0.7, 0.55, 0.42];

function canvasABlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo codificar la imagen'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      calidad,
    );
  });
}

export async function capturarFrameVideoComprimido(video: HTMLVideoElement): Promise<Blob> {
  const anchoOriginal = video.videoWidth || 1280;
  const altoOriginal = video.videoHeight || 720;

  const escala = Math.min(1, DIMENSION_MAXIMA_PX / Math.max(anchoOriginal, altoOriginal));
  const ancho = Math.max(1, Math.round(anchoOriginal * escala));
  const alto = Math.max(1, Math.round(altoOriginal * escala));

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D no disponible');
  }
  ctx.drawImage(video, 0, 0, ancho, alto);

  let ultimoBlob: Blob | null = null;
  for (const calidad of CALIDADES_JPEG) {
    const candidato = await canvasABlob(canvas, calidad);
    ultimoBlob = candidato;
    if (candidato.size <= TAMANO_MAXIMO_BYTES) {
      return candidato;
    }
  }

  if (!ultimoBlob) {
    throw new Error('No se pudo generar la fotografía');
  }

  return ultimoBlob;
}
