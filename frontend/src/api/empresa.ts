import { solicitar } from './cliente';
import { type Empresa, EmpresaSchema, type Idioma, type ReglaRevision } from './esquemas';

export async function obtenerEmpresa(): Promise<Empresa> {
  return solicitar('/empresa', EmpresaSchema);
}

export interface CambiosEmpresa {
  nombre?: string;
  idioma?: Idioma;
  regla_revision?: ReglaRevision;
  muestra_n?: number;
  retencion_fotos_dias?: number;
}

export async function actualizarEmpresa(cambios: CambiosEmpresa): Promise<Empresa> {
  return solicitar('/empresa', EmpresaSchema, { metodo: 'PATCH', cuerpoJson: cambios });
}
