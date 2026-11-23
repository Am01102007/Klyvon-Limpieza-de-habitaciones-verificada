import { Building2, Edit2, Plus, UserPlus, X } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type Habitacion, type Propiedad, type TipoPropiedad } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Campo } from '@/components/Campo';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { InsigniaEstado } from '@/components/InsigniaEstado';
import { Modal } from '@/components/Modal';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Selector } from '@/components/Selector';
import { type ColumnaTabla, Tabla } from '@/components/Tabla';
import { Vacio } from '@/components/Vacio';

import {
  useActualizarHabitacion,
  useActualizarPropiedad,
  useCrearHabitacion,
  useCrearPropiedad,
  useDesvincularSupervisor,
  useHabitaciones,
  usePropiedades,
  useSupervisoresPropiedad,
  useUsuarios,
  useVincularSupervisor,
} from './hooks';

/** Zonas sugeridas; el backend valida cualquier zona IANA. */
const ZONAS_SUGERIDAS = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
];

const PropiedadFormSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  tipo: z.enum(['hotel', 'airbnb']),
  direccion: z.string().trim().max(1000),
  zona_horaria: z.string().trim().min(1).max(64),
});

const HabitacionFormSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  tipo: z.string().trim().max(60),
  fotos_min_entrada: z.number().int().min(1).max(20),
  fotos_min_salida: z.number().int().min(1).max(20),
});

type DialogoPropiedad = { propiedad: Propiedad | null } | null;

export function PropiedadesPage() {
  const { t } = useTranslation();
  const propiedadesQuery = usePropiedades();
  const [seleccionadaId, setSeleccionadaId] = useState('');
  const [dialogo, setDialogo] = useState<DialogoPropiedad>(null);

  if (propiedadesQuery.isPending) {
    return <Cargando />;
  }
  if (propiedadesQuery.isError) {
    return (
      <ErrorPantalla
        error={propiedadesQuery.error}
        alReintentar={() => {
          void propiedadesQuery.refetch();
        }}
      />
    );
  }

  const propiedades = propiedadesQuery.data.items;
  const seleccionada = propiedades.find((p) => p.id === seleccionadaId) ?? propiedades[0];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('propiedades.titulo')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('propiedades.subtitulo')}</p>
        </div>
        <Boton
          variante="primario"
          icono={<Plus className="h-4 w-4" />}
          onClick={() => {
            setDialogo({ propiedad: null });
          }}
        >
          {t('propiedades.nueva_propiedad')}
        </Boton>
      </header>

      {!seleccionada ? (
        <Vacio
          titulo={t('propiedades.vacio_propiedades_titulo')}
          descripcion={t('propiedades.vacio_propiedades_desc')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <ul className="flex flex-col gap-2">
            {propiedades.map((prop) => {
              const activa = prop.id === seleccionada.id;
              return (
                <li
                  key={prop.id}
                  className={[
                    'flex items-center justify-between gap-2 rounded-2xl border p-3.5 transition-colors',
                    activa
                      ? 'border-primario-500 bg-primario-50/70 dark:border-sky-400 dark:bg-primario-950/50'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    aria-current={activa ? 'true' : undefined}
                    onClick={() => {
                      setSeleccionadaId(prop.id);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                  >
                    <Building2
                      className="h-5 w-5 shrink-0 text-primario-500 dark:text-sky-400"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-900 dark:text-white">
                        {prop.nombre}
                      </span>
                      <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
                        {t(`propiedades.tipos.${prop.tipo}`)} · {prop.zona_horaria}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('propiedades.editar_propiedad_de', { nombre: prop.nombre })}
                    onClick={() => {
                      setDialogo({ propiedad: prop });
                    }}
                    className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-5 lg:col-span-2">
            {seleccionada.direccion && (
              <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-300">
                {seleccionada.direccion}
              </p>
            )}
            <SeccionSupervisores key={`s-${seleccionada.id}`} propiedadId={seleccionada.id} />
            <SeccionHabitaciones key={`h-${seleccionada.id}`} propiedad={seleccionada} />
          </div>
        </div>
      )}

      <Modal
        abierto={dialogo !== null}
        titulo={
          dialogo?.propiedad ? t('propiedades.editar_propiedad') : t('propiedades.nueva_propiedad')
        }
        alCerrar={() => {
          setDialogo(null);
        }}
      >
        {dialogo && (
          <FormularioPropiedad
            propiedad={dialogo.propiedad}
            alTerminar={(id) => {
              setSeleccionadaId(id);
              setDialogo(null);
            }}
            alCancelar={() => {
              setDialogo(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormularioPropiedad({
  propiedad,
  alTerminar,
  alCancelar,
}: {
  propiedad: Propiedad | null;
  alTerminar: (id: string) => void;
  alCancelar: () => void;
}) {
  const { t } = useTranslation();
  const crear = useCrearPropiedad();
  const actualizar = useActualizarPropiedad();
  const [nombre, setNombre] = useState(propiedad?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoPropiedad>(propiedad?.tipo ?? 'hotel');
  const [direccion, setDireccion] = useState(propiedad?.direccion ?? '');
  const [zona, setZona] = useState(
    propiedad?.zona_horaria ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [error, setError] = useState<string | null>(null);
  const cargando = crear.isPending || actualizar.isPending;

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const validado = PropiedadFormSchema.safeParse({ nombre, tipo, direccion, zona_horaria: zona });
    if (!validado.success) {
      setError(t('errores.entrada_invalida'));
      return;
    }
    const datos = validado.data;
    try {
      if (propiedad) {
        // El backend ignora null en PATCH: una dirección vacía no se puede borrar (ver FALTANTES.md).
        await actualizar.mutateAsync({
          propiedadId: propiedad.id,
          cambios: {
            nombre: datos.nombre,
            tipo: datos.tipo,
            zona_horaria: datos.zona_horaria,
            ...(datos.direccion ? { direccion: datos.direccion } : {}),
          },
        });
        alTerminar(propiedad.id);
      } else {
        const creada = await crear.mutateAsync({ ...datos, direccion: datos.direccion || null });
        alTerminar(creada.id);
      }
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <Campo
        etiqueta={t('propiedades.nombre_propiedad')}
        value={nombre}
        maxLength={120}
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <Selector
        etiqueta={t('propiedades.tipo')}
        value={tipo}
        opciones={(['hotel', 'airbnb'] as const).map((v) => ({
          valor: v,
          texto: t(`propiedades.tipos.${v}`),
        }))}
        onChange={(e) => {
          setTipo(e.target.value as TipoPropiedad);
        }}
      />
      <Campo
        etiqueta={t('propiedades.direccion')}
        value={direccion}
        maxLength={1000}
        onChange={(e) => {
          setDireccion(e.target.value);
        }}
      />
      <Campo
        etiqueta={t('propiedades.zona_horaria')}
        ayuda={t('propiedades.ayuda_zona')}
        value={zona}
        list="zonas-sugeridas"
        maxLength={64}
        onChange={(e) => {
          setZona(e.target.value);
        }}
      />
      <datalist id="zonas-sugeridas">
        {ZONAS_SUGERIDAS.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Boton type="submit" variante="primario" anchoCompleto cargando={cargando}>
          {cargando ? t('propiedades.guardando') : t('propiedades.guardar')}
        </Boton>
        <Boton variante="secundario" anchoCompleto disabled={cargando} onClick={alCancelar}>
          {t('comun.cancelar')}
        </Boton>
      </div>
    </form>
  );
}

function SeccionSupervisores({ propiedadId }: { propiedadId: string }) {
  const { t } = useTranslation();
  const asignadosQuery = useSupervisoresPropiedad(propiedadId);
  const todosQuery = useUsuarios({ rol: 'supervisor' });
  const vincular = useVincularSupervisor(propiedadId);
  const desvincular = useDesvincularSupervisor(propiedadId);
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState<string | null>(null);

  const asignados = asignadosQuery.data?.items ?? [];
  const idsAsignados = new Set(asignados.map((s) => s.id));
  const disponibles = (todosQuery.data?.items ?? []).filter(
    (s) => s.activo && !idsAsignados.has(s.id),
  );

  const ejecutar = async (accion: () => Promise<void>) => {
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        {t('propiedades.supervisores')}
      </h2>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      {asignadosQuery.isPending ? (
        <Cargando />
      ) : asignadosQuery.isError ? (
        <ErrorPantalla error={asignadosQuery.error} />
      ) : asignados.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('propiedades.sin_supervisores')}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {asignados.map((sup) => (
            <li
              key={sup.id}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1 pr-1 pl-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>{sup.nombre_usuario}</span>
              <button
                type="button"
                aria-label={t('propiedades.quitar_supervisor_de', { nombre: sup.nombre_usuario })}
                disabled={desvincular.isPending}
                onClick={() => void ejecutar(() => desvincular.mutateAsync(sup.id))}
                className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-red-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-red-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Selector
            etiqueta={t('propiedades.agregar_supervisor')}
            value={elegido}
            opcionVacia={t('propiedades.elegir_supervisor')}
            opciones={disponibles.map((s) => ({ valor: s.id, texto: s.nombre_usuario }))}
            onChange={(e) => {
              setElegido(e.target.value);
            }}
          />
        </div>
        <Boton
          variante="secundario"
          disabled={!elegido}
          cargando={vincular.isPending}
          icono={<UserPlus className="h-4 w-4" />}
          onClick={() =>
            void ejecutar(async () => {
              await vincular.mutateAsync(elegido);
              setElegido('');
            })
          }
        >
          {t('propiedades.asignar')}
        </Boton>
      </div>
    </section>
  );
}

function SeccionHabitaciones({ propiedad }: { propiedad: Propiedad }) {
  const { t } = useTranslation();
  const habitacionesQuery = useHabitaciones(propiedad.id);
  const [dialogo, setDialogo] = useState<{ habitacion: Habitacion | null } | null>(null);

  const columnas: ColumnaTabla<Habitacion>[] = [
    {
      clave: 'nombre',
      encabezado: t('propiedades.nombre_habitacion'),
      render: (f) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{f.nombre}</p>
          {f.tipo && <p className="text-xs text-slate-500 dark:text-slate-400">{f.tipo}</p>}
        </div>
      ),
    },
    {
      clave: 'entrada',
      encabezado: t('propiedades.fotos_min_entrada'),
      alineacion: 'derecha',
      render: (f) => f.fotos_min_entrada,
    },
    {
      clave: 'salida',
      encabezado: t('propiedades.fotos_min_salida'),
      alineacion: 'derecha',
      render: (f) => f.fotos_min_salida,
    },
    {
      clave: 'estado',
      encabezado: t('usuarios.estado'),
      render: (f) => <InsigniaEstado estado={f.activa ? 'activo' : 'inactivo'} />,
    },
    {
      clave: 'acciones',
      encabezado: t('comun.acciones'),
      alineacion: 'derecha',
      render: (f) => (
        <Boton
          variante="secundario"
          icono={<Edit2 className="h-4 w-4" />}
          onClick={() => {
            setDialogo({ habitacion: f });
          }}
        >
          {t('comun.editar')}
        </Boton>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('propiedades.habitaciones_de', { nombre: propiedad.nombre })}
        </h2>
        <Boton
          variante="secundario"
          icono={<Plus className="h-4 w-4" />}
          onClick={() => {
            setDialogo({ habitacion: null });
          }}
        >
          {t('propiedades.nueva_habitacion')}
        </Boton>
      </div>
      {habitacionesQuery.isPending ? (
        <Cargando />
      ) : habitacionesQuery.isError ? (
        <ErrorPantalla
          error={habitacionesQuery.error}
          alReintentar={() => {
            void habitacionesQuery.refetch();
          }}
        />
      ) : habitacionesQuery.data.items.length === 0 ? (
        <Vacio
          titulo={t('propiedades.vacio_habitaciones_titulo')}
          descripcion={t('propiedades.vacio_habitaciones_desc')}
        />
      ) : (
        <Tabla
          columnas={columnas}
          filas={habitacionesQuery.data.items}
          obtenerClave={(f) => f.id}
          tituloAccesible={t('propiedades.habitaciones_de', { nombre: propiedad.nombre })}
        />
      )}
      <Modal
        abierto={dialogo !== null}
        titulo={
          dialogo?.habitacion
            ? t('propiedades.editar_habitacion')
            : t('propiedades.nueva_habitacion')
        }
        alCerrar={() => {
          setDialogo(null);
        }}
      >
        {dialogo && (
          <FormularioHabitacion
            propiedadId={propiedad.id}
            habitacion={dialogo.habitacion}
            alTerminar={() => {
              setDialogo(null);
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function FormularioHabitacion({
  propiedadId,
  habitacion,
  alTerminar,
}: {
  propiedadId: string;
  habitacion: Habitacion | null;
  alTerminar: () => void;
}) {
  const { t } = useTranslation();
  const crear = useCrearHabitacion(propiedadId);
  const actualizar = useActualizarHabitacion(propiedadId);
  const [nombre, setNombre] = useState(habitacion?.nombre ?? '');
  const [tipo, setTipo] = useState(habitacion?.tipo ?? '');
  const [minEntrada, setMinEntrada] = useState(habitacion?.fotos_min_entrada ?? 1);
  const [minSalida, setMinSalida] = useState(habitacion?.fotos_min_salida ?? 1);
  const [activa, setActiva] = useState(habitacion?.activa ?? true);
  const [error, setError] = useState<string | null>(null);
  const cargando = crear.isPending || actualizar.isPending;

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const validado = HabitacionFormSchema.safeParse({
      nombre,
      tipo,
      fotos_min_entrada: minEntrada,
      fotos_min_salida: minSalida,
    });
    if (!validado.success) {
      setError(t('propiedades.validacion_habitacion'));
      return;
    }
    const datos = validado.data;
    try {
      if (habitacion) {
        await actualizar.mutateAsync({
          habitacionId: habitacion.id,
          cambios: {
            nombre: datos.nombre,
            fotos_min_entrada: datos.fotos_min_entrada,
            fotos_min_salida: datos.fotos_min_salida,
            activa,
            ...(datos.tipo ? { tipo: datos.tipo } : {}),
          },
        });
      } else {
        await crear.mutateAsync({ ...datos, tipo: datos.tipo || null });
      }
      alTerminar();
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <Campo
        etiqueta={t('propiedades.nombre_habitacion')}
        value={nombre}
        maxLength={60}
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <Campo
        etiqueta={t('propiedades.tipo_habitacion')}
        ayuda={t('propiedades.ayuda_tipo_habitacion')}
        value={tipo}
        maxLength={60}
        onChange={(e) => {
          setTipo(e.target.value);
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta={t('propiedades.fotos_min_entrada')}
          type="number"
          min={1}
          max={20}
          value={minEntrada}
          onChange={(e) => {
            setMinEntrada(Number.parseInt(e.target.value, 10) || 1);
          }}
        />
        <Campo
          etiqueta={t('propiedades.fotos_min_salida')}
          type="number"
          min={1}
          max={20}
          value={minSalida}
          onChange={(e) => {
            setMinSalida(Number.parseInt(e.target.value, 10) || 1);
          }}
        />
      </div>
      {habitacion && (
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => {
              setActiva(e.target.checked);
            }}
            className="h-5 w-5"
          />
          {t('propiedades.habitacion_activa')}
        </label>
      )}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Boton type="submit" variante="primario" anchoCompleto cargando={cargando}>
          {cargando ? t('propiedades.guardando') : t('propiedades.guardar')}
        </Boton>
        <Boton variante="secundario" anchoCompleto disabled={cargando} onClick={alTerminar}>
          {t('comun.cancelar')}
        </Boton>
      </div>
    </form>
  );
}
