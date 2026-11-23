import { Save } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type Empresa, type Idioma, type ReglaRevision } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Campo } from '@/components/Campo';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Selector } from '@/components/Selector';

import { useActualizarEmpresa, useEmpresa } from './hooks';

const EmpresaFormSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  idioma: z.enum(['es', 'en', 'pt']),
  regla_revision: z.enum(['todo', 'muestra', 'riesgo']),
  muestra_n: z.number().int().min(1).max(1000),
  retencion_fotos_dias: z.number().int().min(1).max(3650),
});

const REGLAS: ReglaRevision[] = ['todo', 'muestra', 'riesgo'];

export function EmpresaPage() {
  const empresaQuery = useEmpresa();
  if (empresaQuery.isPending) {
    return <Cargando />;
  }
  if (empresaQuery.isError) {
    return (
      <ErrorPantalla
        error={empresaQuery.error}
        alReintentar={() => {
          void empresaQuery.refetch();
        }}
      />
    );
  }
  // La key reinicia el formulario con los datos guardados (sin efectos que copien estado).
  return <FormularioEmpresa key={JSON.stringify(empresaQuery.data)} empresa={empresaQuery.data} />;
}

function FormularioEmpresa({ empresa }: { empresa: Empresa }) {
  const { t } = useTranslation();
  const actualizar = useActualizarEmpresa();
  const [nombre, setNombre] = useState(empresa.nombre);
  const [idioma, setIdioma] = useState<Idioma>(empresa.idioma);
  const [regla, setRegla] = useState<ReglaRevision>(empresa.regla_revision);
  const [muestraN, setMuestraN] = useState(empresa.muestra_n);
  const [retencion, setRetencion] = useState(empresa.retencion_fotos_dias);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    setGuardado(false);
    const validado = EmpresaFormSchema.safeParse({
      nombre,
      idioma,
      regla_revision: regla,
      muestra_n: muestraN,
      retencion_fotos_dias: retencion,
    });
    if (!validado.success) {
      setError(t('errores.entrada_invalida'));
      return;
    }
    try {
      await actualizar.mutateAsync(validado.data);
      setGuardado(true);
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('empresa.titulo')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('empresa.subtitulo')}</p>
      </header>

      <form
        onSubmit={(e) => void enviar(e)}
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        {error && <NotificacionEstado tipo="error" mensaje={error} />}
        {guardado && <NotificacionEstado tipo="exito" mensaje={t('empresa.guardado_ok')} />}

        <Campo etiqueta={t('empresa.codigo')} value={empresa.codigo} readOnly disabled />
        <Campo etiqueta={t('empresa.plan')} value={empresa.plan} readOnly disabled />
        <Campo
          etiqueta={t('empresa.nombre')}
          value={nombre}
          maxLength={120}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <Selector
          etiqueta={t('empresa.idioma')}
          value={idioma}
          opciones={(['es', 'en', 'pt'] as const).map((i) => ({
            valor: i,
            texto: t(`idiomas.${i}`),
          }))}
          onChange={(e) => {
            setIdioma(e.target.value as Idioma);
          }}
        />
        <p className="-mt-2 text-xs text-slate-600 dark:text-slate-400">
          {t('empresa.ayuda_idioma')}
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {t('empresa.regla_revision')}
          </legend>
          {REGLAS.map((r) => (
            <div
              key={r}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <input
                id={`regla-${r}`}
                type="radio"
                name="regla_revision"
                value={r}
                checked={regla === r}
                aria-describedby={`regla-${r}-desc`}
                onChange={() => {
                  setRegla(r);
                }}
                className="mt-1 h-5 w-5"
              />
              <div>
                <label
                  htmlFor={`regla-${r}`}
                  className="block cursor-pointer font-semibold text-slate-900 dark:text-white"
                >
                  {t(`empresa.reglas.${r}`)}
                </label>
                <p id={`regla-${r}-desc`} className="text-sm text-slate-600 dark:text-slate-300">
                  {t(`empresa.reglas_desc.${r}`)}
                </p>
              </div>
            </div>
          ))}
        </fieldset>

        {regla === 'muestra' && (
          <Campo
            etiqueta={t('empresa.muestra_n')}
            ayuda={t('empresa.ayuda_muestra', { n: muestraN })}
            type="number"
            min={1}
            max={1000}
            value={muestraN}
            onChange={(e) => {
              setMuestraN(Number.parseInt(e.target.value, 10) || 1);
            }}
          />
        )}

        <Campo
          etiqueta={t('empresa.retencion_fotos_dias')}
          ayuda={t('empresa.ayuda_retencion')}
          type="number"
          min={1}
          max={3650}
          value={retencion}
          onChange={(e) => {
            setRetencion(Number.parseInt(e.target.value, 10) || 1);
          }}
        />

        <Boton
          type="submit"
          variante="primario"
          cargando={actualizar.isPending}
          icono={<Save className="h-4 w-4" />}
        >
          {actualizar.isPending ? t('empresa.guardando') : t('empresa.guardar')}
        </Boton>
      </form>
    </div>
  );
}
