import { Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type Asignacion, type EstadoRevision } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Campo } from '@/components/Campo';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { InsigniaEstado, type TipoInsigniaEstado } from '@/components/InsigniaEstado';
import { Modal } from '@/components/Modal';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Paginador } from '@/components/Paginador';
import { Selector } from '@/components/Selector';
import { type ColumnaTabla, Tabla } from '@/components/Tabla';
import { Vacio } from '@/components/Vacio';
import { formatearHoraLimite, obtenerFechaIsoRelativa } from '@/utils/fecha';

import {
  useAsignaciones,
  useCrearAsignacion,
  useEmpleadosCatalogo,
  useEstadoLimpiezasDelDia,
  useHabitacionesCatalogo,
  usePropiedadesCatalogo,
} from './hooks';

const LIMITE = 50;

const INSIGNIA_REVISION: Record<EstadoRevision, TipoInsigniaEstado> = {
  pendiente: 'por_revisar',
  aprobada: 'aprobada',
  rechazada: 'rechazada',
  no_requerida: 'no_requerida',
};

const NuevaAsignacionSchema = z.object({
  fecha: z.iso.date(),
  habitacion_id: z.string().min(1),
  empleado_id: z.string().min(1),
  prioridad: z.number().int().min(1).max(100),
  hora_limite: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

interface FormularioAsignacion {
  fecha: string;
  propiedadId: string;
  habitacionId: string;
  empleadoId: string;
  prioridad: number;
  horaLimite: string;
}

function formularioVacio(fecha: string, propiedadId: string): FormularioAsignacion {
  return { fecha, propiedadId, habitacionId: '', empleadoId: '', prioridad: 1, horaLimite: '' };
}

export function AsignacionesPage() {
  const { t, i18n } = useTranslation();
  const [fechaFiltro, setFechaFiltro] = useState(() => obtenerFechaIsoRelativa(0));
  const [propiedadFiltro, setPropiedadFiltro] = useState('');
  const [empleadoFiltro, setEmpleadoFiltro] = useState('');
  const [desplazamiento, setDesplazamiento] = useState(0);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(() => formularioVacio(fechaFiltro, ''));
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const filtros = {
    fecha: fechaFiltro || undefined,
    propiedadId: propiedadFiltro || undefined,
    empleadoId: empleadoFiltro || undefined,
  };
  const asignacionesQuery = useAsignaciones({ ...filtros, limite: LIMITE, desplazamiento });
  const limpiezaDe = useEstadoLimpiezasDelDia(filtros);
  const propiedades = usePropiedadesCatalogo().data?.items ?? [];
  const empleados = (useEmpleadosCatalogo().data?.items ?? []).filter((u) => u.activo);
  const habitaciones = (useHabitacionesCatalogo(form.propiedadId).data?.items ?? []).filter(
    (h) => h.activa,
  );
  const crearMutation = useCrearAsignacion();

  const nombrePropiedad = new Map(propiedades.map((p) => [p.id, p.nombre]));
  const opcionesPropiedad = propiedades.map((p) => ({ valor: p.id, texto: p.nombre }));
  const opcionesEmpleado = empleados.map((u) => ({ valor: u.id, texto: u.nombre_usuario }));

  const actualizar = (cambios: Partial<FormularioAsignacion>) => {
    setForm((previo) => ({ ...previo, ...cambios }));
  };

  const abrirModal = () => {
    setForm(formularioVacio(fechaFiltro || obtenerFechaIsoRelativa(0), propiedadFiltro));
    setErrorForm(null);
    setModalAbierto(true);
  };

  const manejarCrear = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrorForm(null);
    const validado = NuevaAsignacionSchema.safeParse({
      fecha: form.fecha,
      habitacion_id: form.habitacionId,
      empleado_id: form.empleadoId,
      prioridad: form.prioridad,
      hora_limite: form.horaLimite || undefined,
    });
    if (!validado.success) {
      setErrorForm(t('asignaciones.validacion.campos_requeridos'));
      return;
    }
    try {
      await crearMutation.mutateAsync({
        ...validado.data,
        hora_limite: validado.data.hora_limite ? `${validado.data.hora_limite}:00` : null,
      });
      setModalAbierto(false);
      setAviso(t('asignaciones.creada'));
    } catch (err) {
      setErrorForm(traducirError(err, t));
    }
  };

  const columnas: ColumnaTabla<Asignacion>[] = [
    {
      clave: 'habitacion',
      encabezado: t('asignaciones.habitacion'),
      render: (fila) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{fila.habitacion_nombre}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {nombrePropiedad.get(fila.propiedad_id) ?? '—'}
          </p>
        </div>
      ),
    },
    { clave: 'empleado', encabezado: t('asignaciones.empleado'), render: (f) => f.empleado_nombre },
    { clave: 'fecha', encabezado: t('asignaciones.fecha'), render: (f) => f.fecha },
    {
      clave: 'prioridad',
      encabezado: t('asignaciones.prioridad'),
      alineacion: 'derecha',
      render: (f) => f.prioridad,
    },
    {
      clave: 'limite',
      encabezado: t('asignaciones.hora_limite'),
      render: (f) =>
        f.hora_limite
          ? formatearHoraLimite(f.hora_limite, f.fecha, i18n.language)
          : t('tareas.sin_hora_limite'),
    },
    {
      clave: 'estado',
      encabezado: t('usuarios.estado'),
      render: (f) => {
        const limpieza = limpiezaDe.get(f.id);
        if (!limpieza) {
          return '—';
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            <InsigniaEstado estado={limpieza.estado_trabajo} />
            {limpieza.estado_trabajo === 'enviada' && (
              <InsigniaEstado estado={INSIGNIA_REVISION[limpieza.estado_revision]} />
            )}
            {limpieza.tipo === 'correccion' && (
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {t('revisiones.correccion')}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('asignaciones.titulo')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('asignaciones.subtitulo')}
          </p>
        </div>
        <Boton variante="primario" icono={<Plus className="h-4 w-4" />} onClick={abrirModal}>
          {t('asignaciones.nueva')}
        </Boton>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <Campo
          etiqueta={t('asignaciones.fecha')}
          type="date"
          value={fechaFiltro}
          onChange={(e) => {
            setFechaFiltro(e.target.value);
            setDesplazamiento(0);
          }}
        />
        <Selector
          etiqueta={t('asignaciones.propiedad')}
          value={propiedadFiltro}
          opcionVacia={t('asignaciones.todas_propiedades')}
          opciones={opcionesPropiedad}
          onChange={(e) => {
            setPropiedadFiltro(e.target.value);
            setDesplazamiento(0);
          }}
        />
        <Selector
          etiqueta={t('asignaciones.empleado')}
          value={empleadoFiltro}
          opcionVacia={t('comun.todos')}
          opciones={opcionesEmpleado}
          onChange={(e) => {
            setEmpleadoFiltro(e.target.value);
            setDesplazamiento(0);
          }}
        />
      </section>

      {aviso && <NotificacionEstado tipo="exito" mensaje={aviso} />}

      {asignacionesQuery.isPending ? (
        <Cargando />
      ) : asignacionesQuery.isError ? (
        <ErrorPantalla
          error={asignacionesQuery.error}
          alReintentar={() => {
            void asignacionesQuery.refetch();
          }}
        />
      ) : asignacionesQuery.data.items.length === 0 ? (
        <Vacio
          titulo={t('asignaciones.vacio_titulo')}
          descripcion={t('asignaciones.vacio_descripcion')}
        />
      ) : (
        <>
          <Tabla
            columnas={columnas}
            filas={asignacionesQuery.data.items}
            obtenerClave={(fila) => fila.id}
            tituloAccesible={t('asignaciones.titulo')}
          />
          <Paginador
            desplazamiento={desplazamiento}
            limite={LIMITE}
            total={asignacionesQuery.data.total}
            alCambiar={setDesplazamiento}
          />
        </>
      )}

      <Modal
        abierto={modalAbierto}
        titulo={t('asignaciones.nueva')}
        alCerrar={() => {
          setModalAbierto(false);
        }}
      >
        <form onSubmit={(e) => void manejarCrear(e)} className="flex flex-col gap-4" noValidate>
          {errorForm && <NotificacionEstado tipo="error" mensaje={errorForm} />}
          <Campo
            etiqueta={t('asignaciones.fecha')}
            type="date"
            value={form.fecha}
            disabled={crearMutation.isPending}
            onChange={(e) => {
              actualizar({ fecha: e.target.value });
            }}
          />
          <Selector
            etiqueta={t('asignaciones.propiedad')}
            value={form.propiedadId}
            disabled={crearMutation.isPending}
            opcionVacia={t('asignaciones.seleccionar_propiedad')}
            opciones={opcionesPropiedad}
            onChange={(e) => {
              actualizar({ propiedadId: e.target.value, habitacionId: '' });
            }}
          />
          <Selector
            etiqueta={t('asignaciones.habitacion')}
            value={form.habitacionId}
            disabled={!form.propiedadId || crearMutation.isPending}
            opcionVacia={t('asignaciones.seleccionar_habitacion')}
            opciones={habitaciones.map((h) => ({ valor: h.id, texto: h.nombre }))}
            onChange={(e) => {
              actualizar({ habitacionId: e.target.value });
            }}
          />
          <Selector
            etiqueta={t('asignaciones.empleado')}
            value={form.empleadoId}
            disabled={crearMutation.isPending}
            opcionVacia={t('asignaciones.seleccionar_empleado')}
            opciones={opcionesEmpleado}
            onChange={(e) => {
              actualizar({ empleadoId: e.target.value });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta={t('asignaciones.prioridad')}
              ayuda={t('asignaciones.ayuda_prioridad')}
              type="number"
              min={1}
              max={100}
              value={form.prioridad}
              disabled={crearMutation.isPending}
              onChange={(e) => {
                actualizar({ prioridad: Number.parseInt(e.target.value, 10) || 1 });
              }}
            />
            <Campo
              etiqueta={t('asignaciones.hora_limite')}
              type="time"
              value={form.horaLimite}
              disabled={crearMutation.isPending}
              onChange={(e) => {
                actualizar({ horaLimite: e.target.value });
              }}
            />
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Boton
              type="submit"
              variante="primario"
              anchoCompleto
              cargando={crearMutation.isPending}
            >
              {crearMutation.isPending ? t('asignaciones.creando') : t('asignaciones.crear')}
            </Boton>
            <Boton
              variante="secundario"
              anchoCompleto
              disabled={crearMutation.isPending}
              onClick={() => {
                setModalAbierto(false);
              }}
            >
              {t('comun.cancelar')}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
