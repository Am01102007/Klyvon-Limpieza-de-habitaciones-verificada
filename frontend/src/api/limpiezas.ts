import { solicitar } from './cliente';
import {
  type CategoriaDano,
  type Dano,
  DanoSchema,
  type DetalleLimpieza,
  DetalleLimpiezaSchema,
  type Foto,
  FotoSchema,
  type GravedadDano,
  type Limpieza,
  LimpiezaSchema,
  type MotivoPausa,
  type Pausa,
  PausaSchema,
} from './esquemas';

export async function obtenerDetalleLimpieza(limpiezaId: string): Promise<DetalleLimpieza> {
  return solicitar(`/limpiezas/${encodeURIComponent(limpiezaId)}`, DetalleLimpiezaSchema);
}

export async function iniciarLimpieza(params: {
  limpiezaId: string;
  archivo: Blob;
  fotoId: string;
}): Promise<Limpieza> {
  const formData = new FormData();
  formData.append('archivo', params.archivo, 'entrada.jpg');
  formData.append('foto_id', params.fotoId);

  return solicitar(`/limpiezas/${encodeURIComponent(params.limpiezaId)}/iniciar`, LimpiezaSchema, {
    metodo: 'POST',
    cuerpoFormData: formData,
  });
}

export async function subirFotoLimpieza(params: {
  limpiezaId: string;
  momento: 'entrada' | 'salida';
  archivo: Blob;
  fotoId: string;
}): Promise<Foto> {
  const formData = new FormData();
  formData.append('momento', params.momento);
  formData.append('archivo', params.archivo, `${params.momento}.jpg`);
  formData.append('foto_id', params.fotoId);

  return solicitar(`/limpiezas/${encodeURIComponent(params.limpiezaId)}/fotos`, FotoSchema, {
    metodo: 'POST',
    cuerpoFormData: formData,
  });
}

export async function reportarDanoLimpieza(params: {
  limpiezaId: string;
  categoria: CategoriaDano;
  gravedad: GravedadDano;
  archivo: Blob;
  nota?: string;
  danoId: string;
}): Promise<Dano> {
  const formData = new FormData();
  formData.append('categoria', params.categoria);
  formData.append('gravedad', params.gravedad);
  formData.append('archivo', params.archivo, 'dano.jpg');
  formData.append('dano_id', params.danoId);
  if (params.nota && params.nota.trim().length > 0) {
    formData.append('nota', params.nota.trim());
  }

  return solicitar(`/limpiezas/${encodeURIComponent(params.limpiezaId)}/danos`, DanoSchema, {
    metodo: 'POST',
    cuerpoFormData: formData,
  });
}

export async function crearPausaLimpieza(params: {
  limpiezaId: string;
  motivo: MotivoPausa;
  id: string;
}): Promise<Pausa> {
  return solicitar(`/limpiezas/${encodeURIComponent(params.limpiezaId)}/pausas`, PausaSchema, {
    metodo: 'POST',
    cuerpoJson: {
      motivo: params.motivo,
      id: params.id,
    },
  });
}

export async function reanudarPausaLimpieza(limpiezaId: string): Promise<Pausa> {
  return solicitar(`/limpiezas/${encodeURIComponent(limpiezaId)}/reanudar`, PausaSchema, {
    metodo: 'POST',
  });
}

export async function finalizarLimpieza(limpiezaId: string): Promise<Limpieza> {
  return solicitar(`/limpiezas/${encodeURIComponent(limpiezaId)}/finalizar`, LimpiezaSchema, {
    metodo: 'POST',
  });
}
