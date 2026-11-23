import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CategoriaDano,
  DetalleLimpiezaSchema,
  type GravedadDano,
  type MotivoPausa,
} from '@/api/esquemas';
import {
  crearPausaLimpieza,
  finalizarLimpieza,
  iniciarLimpieza,
  obtenerDetalleLimpieza,
  reanudarPausaLimpieza,
  reportarDanoLimpieza,
  subirFotoLimpieza,
} from '@/api/limpiezas';
import { conRespaldoLocal } from '@/offline/respaldo';

import { tareasKeys } from '../tareas/hooks';

export const limpiezasKeys = {
  all: ['limpiezas'] as const,
  detalle: (limpiezaId: string) => [...limpiezasKeys.all, 'detalle', limpiezaId] as const,
};

export function useDetalleLimpieza(limpiezaId: string) {
  return useQuery({
    queryKey: limpiezasKeys.detalle(limpiezaId),
    queryFn: () =>
      conRespaldoLocal(`limpieza:${limpiezaId}`, DetalleLimpiezaSchema, () =>
        obtenerDetalleLimpieza(limpiezaId),
      ),
    enabled: Boolean(limpiezaId),
    networkMode: 'offlineFirst',
  });
}

export function useIniciarLimpieza(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { archivo: Blob; fotoId: string }) =>
      iniciarLimpieza({ limpiezaId, archivo: params.archivo, fotoId: params.fotoId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) }),
        queryClient.invalidateQueries({ queryKey: tareasKeys.all }),
      ]);
    },
  });
}

export function useSubirFoto(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { momento: 'entrada' | 'salida'; archivo: Blob; fotoId: string }) =>
      subirFotoLimpieza({
        limpiezaId,
        momento: params.momento,
        archivo: params.archivo,
        fotoId: params.fotoId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) });
    },
  });
}

export function useReportarDano(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      categoria: CategoriaDano;
      gravedad: GravedadDano;
      archivo: Blob;
      nota?: string;
      danoId: string;
    }) =>
      reportarDanoLimpieza({
        limpiezaId,
        categoria: params.categoria,
        gravedad: params.gravedad,
        archivo: params.archivo,
        nota: params.nota,
        danoId: params.danoId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) });
    },
  });
}

export function useCrearPausa(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { motivo: MotivoPausa; id: string }) =>
      crearPausaLimpieza({ limpiezaId, motivo: params.motivo, id: params.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) });
    },
  });
}

export function useReanudarPausa(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reanudarPausaLimpieza(limpiezaId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) });
    },
  });
}

export function useFinalizarLimpieza(limpiezaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finalizarLimpieza(limpiezaId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: limpiezasKeys.detalle(limpiezaId) }),
        queryClient.invalidateQueries({ queryKey: tareasKeys.all }),
      ]);
    },
  });
}
