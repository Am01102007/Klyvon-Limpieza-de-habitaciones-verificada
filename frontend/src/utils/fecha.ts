/**
 * Formatea una fecha ISO UTC en la zona horaria IANA de la propiedad.
 */
export function formatearFechaHoraPropiedad(
  isoUtc: string,
  zonaHoraria: string,
  idioma: string,
): string {
  const fecha = new Date(isoUtc);
  if (Number.isNaN(fecha.getTime())) {
    return isoUtc;
  }
  return new Intl.DateTimeFormat(idioma, {
    timeZone: zonaHoraria,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(fecha);
}

/**
 * Formatea una hora límite "HH:MM:SS" usando Intl.DateTimeFormat en la zona horaria de la propiedad.
 */
export function formatearHoraLimite(horaLimite: string, fechaBase: string, idioma: string): string {
  const partesHora = horaLimite.split(':');
  const hh = Number.parseInt(partesHora[0] ?? '0', 10);
  const mm = Number.parseInt(partesHora[1] ?? '0', 10);
  const partesFecha = fechaBase.split('-');
  const anio = Number.parseInt(partesFecha[0] ?? '2026', 10);
  const mes = Number.parseInt(partesFecha[1] ?? '1', 10) - 1;
  const dia = Number.parseInt(partesFecha[2] ?? '1', 10);

  if ([hh, mm, anio, mes, dia].some((n) => Number.isNaN(n))) {
    return horaLimite.slice(0, 5);
  }

  const referencia = new Date(Date.UTC(anio, mes, dia, hh, mm, 0));
  return new Intl.DateTimeFormat(idioma, {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  }).format(referencia);
}

/**
 * Formatea una duración en segundos al estilo "25 min" (o "0 min").
 */
export function formatearDuracionMinutos(segundos: number): string {
  const minutos = Math.max(0, Math.round(segundos / 60));
  return `${String(minutos)} min`;
}

/**
 * Formatea un conteo de segundos a HH:MM:SS para el cronómetro visual.
 */
export function formatearCronometro(segundosTotales: number): string {
  const limpios = Math.max(0, Math.floor(segundosTotales));
  const horas = Math.floor(limpios / 3600);
  const minutos = Math.floor((limpios % 3600) / 60);
  const segundos = limpios % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}

/**
 * Devuelve la fecha local actual en formato YYYY-MM-DD (con desplazamiento opcional en días).
 */
export function obtenerFechaIsoRelativa(diasDesplazamiento = 0): string {
  const base = new Date();
  base.setDate(base.getDate() + diasDesplazamiento);
  const anio = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, '0');
  const dia = String(base.getDate()).padStart(2, '0');
  return `${String(anio)}-${mes}-${dia}`;
}
