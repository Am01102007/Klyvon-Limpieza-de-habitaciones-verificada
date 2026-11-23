import { type Pausa } from '@/api/esquemas';

export function calcularSegundosNetosTranscurridos(
  inicioIso: string | null,
  pausas: readonly Pick<Pausa, 'inicio' | 'fin'>[],
  ahoraMs: number = Date.now(),
  duracionNetaFija: number | null = null,
): number {
  if (duracionNetaFija !== null) {
    return Math.max(0, Math.floor(duracionNetaFija));
  }
  if (!inicioIso) {
    return 0;
  }

  const inicioMs = new Date(inicioIso).getTime();
  if (Number.isNaN(inicioMs)) {
    return 0;
  }

  const totalBrutoMs = Math.max(0, ahoraMs - inicioMs);
  let totalPausasMs = 0;

  for (const pausa of pausas) {
    const pInicioMs = new Date(pausa.inicio).getTime();
    if (Number.isNaN(pInicioMs)) {
      continue;
    }
    const pFinMs = pausa.fin ? new Date(pausa.fin).getTime() : ahoraMs;
    if (Number.isNaN(pFinMs)) {
      continue;
    }
    if (pFinMs > pInicioMs) {
      totalPausasMs += pFinMs - pInicioMs;
    }
  }

  const netoMs = Math.max(0, totalBrutoMs - totalPausasMs);
  return Math.floor(netoMs / 1000);
}
