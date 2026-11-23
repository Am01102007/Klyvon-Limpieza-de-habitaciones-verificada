import { Camera } from 'lucide-react';
import { type SubmitEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  type CategoriaDano,
  CategoriaDanoSchema,
  type GravedadDano,
  GravedadDanoSchema,
} from '@/api/esquemas';
import { Boton } from '@/components/Boton';

import { CamaraEnVivo } from './CamaraEnVivo';

const FormularioDanoSchema = z.object({
  categoria: CategoriaDanoSchema,
  gravedad: GravedadDanoSchema,
  nota: z.string().max(500).optional(),
});

export interface DatosNuevoDano {
  categoria: CategoriaDano;
  gravedad: GravedadDano;
  nota?: string;
  archivo: Blob;
}

export interface FormularioDanoProps {
  alEnviar: (datos: DatosNuevoDano) => Promise<void>;
  alCancelar: () => void;
  enviando?: boolean;
}

const CATEGORIAS: CategoriaDano[] = ['rotura', 'mancha', 'faltante', 'aparato', 'otro'];
const GRAVEDADES: GravedadDano[] = ['leve', 'urgente'];

export function FormularioDano({ alEnviar, alCancelar, enviando = false }: FormularioDanoProps) {
  const { t } = useTranslation();
  const [categoria, setCategoria] = useState<CategoriaDano>('rotura');
  const [gravedad, setGravedad] = useState<GravedadDano>('leve');
  const [nota, setNota] = useState('');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [urlPrevia, setUrlPrevia] = useState<string | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlPrevia) {
        URL.revokeObjectURL(urlPrevia);
      }
    };
  }, [urlPrevia]);

  const manejarFotoCapturada = (blob: Blob) => {
    if (urlPrevia) {
      URL.revokeObjectURL(urlPrevia);
    }
    setFotoBlob(blob);
    setUrlPrevia(URL.createObjectURL(blob));
    setErrorFoto(null);
    setCamaraAbierta(false);
  };

  const manejarSubmit = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();

    if (!fotoBlob) {
      setErrorFoto(t('limpieza.danos.form.foto_requerida'));
      return;
    }

    const validado = FormularioDanoSchema.safeParse({
      categoria,
      gravedad,
      nota: nota.trim() || undefined,
    });

    if (!validado.success) {
      return;
    }

    await alEnviar({
      categoria: validado.data.categoria,
      gravedad: validado.data.gravedad,
      nota: validado.data.nota,
      archivo: fotoBlob,
    });
  };

  return (
    <form onSubmit={(e) => void manejarSubmit(e)} className="flex flex-col gap-4" noValidate>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">
        {t('limpieza.danos.form.titulo')}
      </h3>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {t('limpieza.danos.form.foto_label')}
        </span>

        {camaraAbierta ? (
          <CamaraEnVivo
            alCapturar={manejarFotoCapturada}
            alCancelar={() => {
              setCamaraAbierta(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {urlPrevia && (
              <img
                src={urlPrevia}
                alt={t('camara.vista_previa_alt')}
                className="aspect-4/3 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-700"
              />
            )}
            <Boton
              variante="secundario"
              disabled={enviando}
              icono={<Camera className="h-4 w-4" />}
              onClick={() => {
                setCamaraAbierta(true);
              }}
            >
              {urlPrevia ? t('camara.retomar') : t('camara.capturar')}
            </Boton>
          </div>
        )}

        {errorFoto && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {errorFoto}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dano-categoria"
          className="text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          {t('limpieza.danos.form.categoria')}
        </label>
        <select
          id="dano-categoria"
          value={categoria}
          disabled={enviando}
          onChange={(e) => {
            setCategoria(e.target.value as CategoriaDano);
          }}
          className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {CATEGORIAS.map((cat) => (
            <option key={cat} value={cat}>
              {t(`limpieza.danos.categorias.${cat}`)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {t('limpieza.danos.form.gravedad')}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {GRAVEDADES.map((grav) => {
            const seleccionada = gravedad === grav;
            return (
              <button
                key={grav}
                type="button"
                disabled={enviando}
                aria-pressed={seleccionada}
                onClick={() => {
                  setGravedad(grav);
                }}
                className={[
                  'min-h-[48px] cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                  seleccionada
                    ? grav === 'urgente'
                      ? 'border-red-500 bg-red-50 text-red-800 dark:border-red-400 dark:bg-red-950/60 dark:text-red-200'
                      : 'border-primario-500 bg-primario-50 text-primario-800 dark:border-sky-400 dark:bg-primario-950/60 dark:text-sky-200'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
                ].join(' ')}
              >
                {t(`limpieza.danos.gravedades.${grav}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dano-nota"
          className="text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          {t('limpieza.danos.form.nota')}
        </label>
        <textarea
          id="dano-nota"
          rows={3}
          maxLength={500}
          disabled={enviando}
          value={nota}
          onChange={(e) => {
            setNota(e.target.value);
          }}
          placeholder={t('limpieza.danos.form.nota_placeholder')}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Boton type="submit" variante="primario" anchoCompleto cargando={enviando}>
          {enviando ? t('limpieza.danos.form.guardando') : t('limpieza.danos.form.guardar')}
        </Boton>
        <Boton variante="secundario" anchoCompleto disabled={enviando} onClick={alCancelar}>
          {t('limpieza.danos.form.cancelar')}
        </Boton>
      </div>
    </form>
  );
}
