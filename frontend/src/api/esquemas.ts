import { z } from 'zod';

export const CampoErrorSchema = z.object({
  campo: z.string(),
  tipo: z.string(),
});

export const ErrorApiBodySchema = z.object({
  codigo: z.string(),
  campos: z.array(CampoErrorSchema).optional(),
});

export type CampoError = z.infer<typeof CampoErrorSchema>;
export type ErrorApiBody = z.infer<typeof ErrorApiBodySchema>;

export function crearPaginaSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    limite: z.number().int().positive(),
    desplazamiento: z.number().int().nonnegative(),
  });
}

export type Pagina<T> = {
  items: T[];
  total: number;
  limite: number;
  desplazamiento: number;
};

export const RolSchema = z.enum(['admin', 'supervisor', 'empleado']);
export type Rol = z.infer<typeof RolSchema>;

export const IdiomaSchema = z.enum(['es', 'en', 'pt']);
export type Idioma = z.infer<typeof IdiomaSchema>;

export const TipoClaveSchema = z.enum(['contrasena', 'pin']);
export type TipoClave = z.infer<typeof TipoClaveSchema>;

export const UsuarioSchema = z.object({
  id: z.string(),
  empresa_id: z.string(),
  nombre_usuario: z.string(),
  tipo_clave: TipoClaveSchema,
  rol: RolSchema,
  idioma: IdiomaSchema,
  activo: z.boolean(),
  creado_en: z.string(),
});
export type Usuario = z.infer<typeof UsuarioSchema>;
export const PaginaUsuariosSchema = crearPaginaSchema(UsuarioSchema);

export const LoginEntradaSchema = z.object({
  codigo_empresa: z.string().trim().min(1).max(20),
  nombre_usuario: z.string().trim().min(1).max(60),
  clave: z.string().min(1).max(128),
});
export type LoginEntrada = z.infer<typeof LoginEntradaSchema>;

export const SesionSalidaSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('bearer'),
  expira_en_seg: z.number(),
  usuario: UsuarioSchema,
});
export type SesionSalida = z.infer<typeof SesionSalidaSchema>;

export const EstadoTrabajoSchema = z.enum(['pendiente', 'en_curso', 'enviada']);
export type EstadoTrabajo = z.infer<typeof EstadoTrabajoSchema>;

export const EstadoRevisionSchema = z.enum(['no_requerida', 'pendiente', 'aprobada', 'rechazada']);
export type EstadoRevision = z.infer<typeof EstadoRevisionSchema>;

export const TipoLimpiezaSchema = z.enum(['normal', 'correccion']);
export type TipoLimpieza = z.infer<typeof TipoLimpiezaSchema>;

export const TareaDelDiaSchema = z.object({
  limpieza_id: z.string(),
  tipo: TipoLimpiezaSchema,
  estado_trabajo: EstadoTrabajoSchema,
  estado_revision: EstadoRevisionSchema,
  inicio: z.string().nullable(),
  asignacion_id: z.string(),
  fecha: z.string(),
  prioridad: z.number(),
  hora_limite: z.string().nullable(),
  habitacion_id: z.string(),
  habitacion_nombre: z.string(),
  fotos_min_entrada: z.number().int().positive(),
  fotos_min_salida: z.number().int().positive(),
  propiedad_nombre: z.string(),
  zona_horaria: z.string(),
  comentario_rechazo: z.string().nullable(),
});
export type TareaDelDia = z.infer<typeof TareaDelDiaSchema>;
export const PaginaTareasDelDiaSchema = crearPaginaSchema(TareaDelDiaSchema);

export const MotivoPausaSchema = z.enum(['descanso', 'falta_insumos', 'huesped_en_habitacion']);
export type MotivoPausa = z.infer<typeof MotivoPausaSchema>;

export const CategoriaDanoSchema = z.enum(['rotura', 'mancha', 'faltante', 'aparato', 'otro']);
export type CategoriaDano = z.infer<typeof CategoriaDanoSchema>;

export const GravedadDanoSchema = z.enum(['leve', 'urgente']);
export type GravedadDano = z.infer<typeof GravedadDanoSchema>;

export const EstadoDanoSchema = z.enum(['abierto', 'en_reparacion', 'resuelto']);
export type EstadoDano = z.infer<typeof EstadoDanoSchema>;

export const MomentoFotoSchema = z.enum(['entrada', 'salida', 'dano']);
export type MomentoFoto = z.infer<typeof MomentoFotoSchema>;

export const LimpiezaSchema = z.object({
  id: z.string(),
  asignacion_id: z.string(),
  empleado_id: z.string(),
  tipo: TipoLimpiezaSchema,
  limpieza_origen_id: z.string().nullable(),
  inicio: z.string().nullable(),
  fin: z.string().nullable(),
  duracion_neta_seg: z.number().nullable(),
  estado_trabajo: EstadoTrabajoSchema,
  requiere_revision: z.boolean(),
  estado_revision: EstadoRevisionSchema,
});
export type Limpieza = z.infer<typeof LimpiezaSchema>;

export const FotoSchema = z.object({
  id: z.string(),
  limpieza_id: z.string(),
  dano_id: z.string().nullable(),
  momento: MomentoFotoSchema,
  url: z.string(),
  tomada_en: z.string(),
  tamano_kb: z.number(),
});
export type Foto = z.infer<typeof FotoSchema>;

export const PausaSchema = z.object({
  id: z.string(),
  limpieza_id: z.string(),
  motivo: MotivoPausaSchema,
  inicio: z.string(),
  fin: z.string().nullable(),
});
export type Pausa = z.infer<typeof PausaSchema>;

export const DanoSchema = z.object({
  id: z.string(),
  limpieza_id: z.string(),
  categoria: CategoriaDanoSchema,
  gravedad: GravedadDanoSchema,
  nota: z.string().nullable(),
  estado: EstadoDanoSchema,
  creado_en: z.string(),
});
export type Dano = z.infer<typeof DanoSchema>;

export const RevisionSchema = z.object({
  id: z.string(),
  limpieza_id: z.string(),
  supervisor_id: z.string(),
  resultado: z.enum(['aprobada', 'rechazada']),
  comentario: z.string().nullable(),
  revisado_en: z.string(),
});
export type Revision = z.infer<typeof RevisionSchema>;

export const DetalleLimpiezaSchema = z.object({
  limpieza: LimpiezaSchema,
  habitacion_nombre: z.string(),
  fecha: z.string(),
  fotos: z.array(FotoSchema),
  pausas: z.array(PausaSchema),
  danos: z.array(DanoSchema),
  revision: RevisionSchema.nullable(),
});
export type DetalleLimpieza = z.infer<typeof DetalleLimpiezaSchema>;

export const LimpiezaResumenSchema = LimpiezaSchema.extend({
  fecha: z.string(),
  habitacion_id: z.string(),
  habitacion_nombre: z.string(),
  propiedad_id: z.string(),
  empleado_nombre: z.string(),
});
export type LimpiezaResumen = z.infer<typeof LimpiezaResumenSchema>;
export const PaginaLimpiezasSchema = crearPaginaSchema(LimpiezaResumenSchema);

export const AsignacionCreadaSchema = z.object({
  id: z.string(),
  habitacion_id: z.string(),
  empleado_id: z.string(),
  asignado_por: z.string(),
  fecha: z.string(),
  prioridad: z.number().int(),
  hora_limite: z.string().nullable(),
});
export type AsignacionCreada = z.infer<typeof AsignacionCreadaSchema>;

export const AsignacionSchema = AsignacionCreadaSchema.extend({
  habitacion_nombre: z.string(),
  propiedad_id: z.string(),
  empleado_nombre: z.string(),
});
export type Asignacion = z.infer<typeof AsignacionSchema>;
export const PaginaAsignacionesSchema = crearPaginaSchema(AsignacionSchema);

export const DanoResumenSchema = DanoSchema.extend({
  habitacion_id: z.string(),
  habitacion_nombre: z.string(),
  propiedad_id: z.string(),
});
export type DanoResumen = z.infer<typeof DanoResumenSchema>;
export const PaginaDanosSchema = crearPaginaSchema(DanoResumenSchema);

export const DanoHistorialSchema = z.object({
  id: z.string(),
  usuario_id: z.string(),
  estado_anterior: EstadoDanoSchema,
  estado_nuevo: EstadoDanoSchema,
  cambiado_en: z.string(),
});
export type DanoHistorial = z.infer<typeof DanoHistorialSchema>;

export const DetalleDanoSchema = z.object({
  dano: DanoSchema,
  propiedad_id: z.string(),
  fotos: z.array(FotoSchema),
  historial: z.array(DanoHistorialSchema),
});
export type DetalleDano = z.infer<typeof DetalleDanoSchema>;

export const TiempoHabitacionSchema = z.object({
  habitacion_id: z.string(),
  habitacion_nombre: z.string(),
  propiedad_nombre: z.string(),
  promedio_seg: z.number().nonnegative(),
  limpiezas: z.number().int().nonnegative(),
});
export type TiempoHabitacion = z.infer<typeof TiempoHabitacionSchema>;
export const PaginaTiemposHabitacionSchema = crearPaginaSchema(TiempoHabitacionSchema);

export const TiempoEmpleadoSchema = z.object({
  empleado_id: z.string(),
  empleado_nombre: z.string(),
  promedio_seg: z.number().nonnegative(),
  limpiezas: z.number().int().nonnegative(),
});
export type TiempoEmpleado = z.infer<typeof TiempoEmpleadoSchema>;
export const PaginaTiemposEmpleadoSchema = crearPaginaSchema(TiempoEmpleadoSchema);

export const DanosPropiedadSchema = z.object({
  propiedad_id: z.string(),
  propiedad_nombre: z.string(),
  total: z.number().int().nonnegative(),
  abiertos: z.number().int().nonnegative(),
  en_reparacion: z.number().int().nonnegative(),
  resueltos: z.number().int().nonnegative(),
  urgentes: z.number().int().nonnegative(),
});
export type DanosPropiedad = z.infer<typeof DanosPropiedadSchema>;
export const PaginaDanosPropiedadSchema = crearPaginaSchema(DanosPropiedadSchema);

export const TipoPropiedadSchema = z.enum(['hotel', 'airbnb']);
export type TipoPropiedad = z.infer<typeof TipoPropiedadSchema>;

export const PropiedadSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  tipo: TipoPropiedadSchema,
  direccion: z.string().nullable(),
  zona_horaria: z.string(),
});
export type Propiedad = z.infer<typeof PropiedadSchema>;
export const PaginaPropiedadesSchema = crearPaginaSchema(PropiedadSchema);

export const HabitacionSchema = z.object({
  id: z.string(),
  propiedad_id: z.string(),
  nombre: z.string(),
  tipo: z.string().nullable(),
  fotos_min_entrada: z.number().int().positive(),
  fotos_min_salida: z.number().int().positive(),
  activa: z.boolean(),
});
export type Habitacion = z.infer<typeof HabitacionSchema>;
export const PaginaHabitacionesSchema = crearPaginaSchema(HabitacionSchema);

export const ReglaRevisionSchema = z.enum(['todo', 'muestra', 'riesgo']);
export type ReglaRevision = z.infer<typeof ReglaRevisionSchema>;

export const EmpresaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  codigo: z.string(),
  idioma: IdiomaSchema,
  plan: z.string(),
  regla_revision: ReglaRevisionSchema,
  muestra_n: z.number().int().positive(),
  retencion_fotos_dias: z.number().int().positive(),
});
export type Empresa = z.infer<typeof EmpresaSchema>;
