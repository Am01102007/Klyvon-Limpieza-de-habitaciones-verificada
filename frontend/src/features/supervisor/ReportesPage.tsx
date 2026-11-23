import { Download } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type DanosPropiedad, type TiempoEmpleado, type TiempoHabitacion } from '@/api/esquemas';
import { type FiltrosReporte, type TipoReporte } from '@/api/reportes';
import { Boton } from '@/components/Boton';
import { Campo } from '@/components/Campo';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla, traducirError } from '@/components/ErrorPantalla';
import { NotificacionEstado } from '@/components/NotificacionEstado';
import { Selector } from '@/components/Selector';
import { type ColumnaTabla, Tabla } from '@/components/Tabla';
import { formatearDuracionMinutos, obtenerFechaIsoRelativa } from '@/utils/fecha';

import {
  useDescargarReportePdf,
  useEmpleadosCatalogo,
  usePropiedadesCatalogo,
  useReporteDanos,
  useReporteTiemposEmpleados,
  useReporteTiemposHabitaciones,
} from './hooks';

const TIPOS: TipoReporte[] = ['tiempos/habitaciones', 'tiempos/empleados', 'danos'];

const CLAVE_TIPO: Record<TipoReporte, string> = {
  'tiempos/habitaciones': 'habitaciones',
  'tiempos/empleados': 'empleados',
  danos: 'danos',
};

function guardarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function ReportesPage() {
  const { t } = useTranslation();
  const [tipo, setTipo] = useState<TipoReporte>('tiempos/habitaciones');
  const [desde, setDesde] = useState(() => obtenerFechaIsoRelativa(-7));
  const [hasta, setHasta] = useState(() => obtenerFechaIsoRelativa(0));
  const [propiedadId, setPropiedadId] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const propiedades = usePropiedadesCatalogo().data?.items ?? [];
  const empleados = useEmpleadosCatalogo().data?.items ?? [];
  const descargar = useDescargarReportePdf();

  const filtros: FiltrosReporte = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    propiedadId: propiedadId || undefined,
    empleadoId: tipo === 'danos' ? undefined : empleadoId || undefined,
  };

  const descargarPdf = async () => {
    setErrorPdf(null);
    try {
      const blob = await descargar.mutateAsync({ tipo, filtros });
      guardarBlob(blob, `reporte-${CLAVE_TIPO[tipo]}-${desde}-${hasta}.pdf`);
    } catch (err) {
      setErrorPdf(traducirError(err, t));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('reportes.titulo')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('reportes.subtitulo')}</p>
        </div>
        <Boton
          variante="secundario"
          cargando={descargar.isPending}
          icono={<Download className="h-4 w-4" />}
          onClick={() => void descargarPdf()}
        >
          {t('reportes.descargar_pdf')}
        </Boton>
      </header>

      <div role="tablist" aria-label={t('reportes.titulo')} className="flex flex-wrap gap-2">
        {TIPOS.map((opcion) => (
          <button
            key={opcion}
            type="button"
            role="tab"
            aria-selected={tipo === opcion}
            onClick={() => {
              setTipo(opcion);
            }}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${
              tipo === opcion
                ? 'bg-primario-600 text-white'
                : 'border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {t(`reportes.tipo_${CLAVE_TIPO[opcion]}`)}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <Campo
          etiqueta={t('reportes.desde')}
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => {
            setDesde(e.target.value);
          }}
        />
        <Campo
          etiqueta={t('reportes.hasta')}
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => {
            setHasta(e.target.value);
          }}
        />
        <Selector
          etiqueta={t('asignaciones.propiedad')}
          value={propiedadId}
          opcionVacia={t('asignaciones.todas_propiedades')}
          opciones={propiedades.map((p) => ({ valor: p.id, texto: p.nombre }))}
          onChange={(e) => {
            setPropiedadId(e.target.value);
          }}
        />
        {tipo !== 'danos' && (
          <Selector
            etiqueta={t('asignaciones.empleado')}
            value={empleadoId}
            opcionVacia={t('comun.todos')}
            opciones={empleados.map((u) => ({ valor: u.id, texto: u.nombre_usuario }))}
            onChange={(e) => {
              setEmpleadoId(e.target.value);
            }}
          />
        )}
      </section>

      {errorPdf && <NotificacionEstado tipo="error" mensaje={errorPdf} />}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('reportes.nota_correcciones')}
      </p>

      {tipo === 'tiempos/habitaciones' && <ReporteHabitaciones filtros={filtros} />}
      {tipo === 'tiempos/empleados' && <ReporteEmpleados filtros={filtros} />}
      {tipo === 'danos' && <ReporteDanos filtros={filtros} />}
    </div>
  );
}

interface EstadoConsulta<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data?: { items: T[] };
  refetch: () => Promise<unknown>;
}

function Resultado<T>({
  consulta,
  render,
}: {
  consulta: EstadoConsulta<T>;
  render: (items: T[]) => ReactNode;
}) {
  if (consulta.isPending) {
    return <Cargando />;
  }
  if (consulta.isError || !consulta.data) {
    return (
      <ErrorPantalla
        error={consulta.error}
        alReintentar={() => {
          void consulta.refetch();
        }}
      />
    );
  }
  return render(consulta.data.items);
}

function ReporteHabitaciones({ filtros }: { filtros: FiltrosReporte }) {
  const { t } = useTranslation();
  const consulta = useReporteTiemposHabitaciones(filtros);
  const columnas: ColumnaTabla<TiempoHabitacion>[] = [
    {
      clave: 'habitacion',
      encabezado: t('reportes.col_habitacion'),
      render: (f) => f.habitacion_nombre,
    },
    {
      clave: 'propiedad',
      encabezado: t('reportes.col_propiedad'),
      render: (f) => f.propiedad_nombre,
    },
    {
      clave: 'promedio',
      encabezado: t('reportes.col_promedio'),
      alineacion: 'derecha',
      render: (f) => formatearDuracionMinutos(f.promedio_seg),
    },
    {
      clave: 'n',
      encabezado: t('reportes.col_limpiezas'),
      alineacion: 'derecha',
      render: (f) => f.limpiezas,
    },
  ];
  return (
    <Resultado
      consulta={consulta}
      render={(items) => (
        <Tabla
          columnas={columnas}
          filas={items}
          obtenerClave={(f) => f.habitacion_id}
          tituloAccesible={t('reportes.tipo_habitaciones')}
        />
      )}
    />
  );
}

function ReporteEmpleados({ filtros }: { filtros: FiltrosReporte }) {
  const { t } = useTranslation();
  const consulta = useReporteTiemposEmpleados(filtros);
  const columnas: ColumnaTabla<TiempoEmpleado>[] = [
    { clave: 'empleado', encabezado: t('reportes.col_empleado'), render: (f) => f.empleado_nombre },
    {
      clave: 'promedio',
      encabezado: t('reportes.col_promedio'),
      alineacion: 'derecha',
      render: (f) => formatearDuracionMinutos(f.promedio_seg),
    },
    {
      clave: 'n',
      encabezado: t('reportes.col_limpiezas'),
      alineacion: 'derecha',
      render: (f) => f.limpiezas,
    },
  ];
  return (
    <Resultado
      consulta={consulta}
      render={(items) => (
        <Tabla
          columnas={columnas}
          filas={items}
          obtenerClave={(f) => f.empleado_id}
          tituloAccesible={t('reportes.tipo_empleados')}
        />
      )}
    />
  );
}

function ReporteDanos({ filtros }: { filtros: FiltrosReporte }) {
  const { t } = useTranslation();
  const consulta = useReporteDanos(filtros);
  const numero = (
    clave: keyof DanosPropiedad,
    encabezado: string,
  ): ColumnaTabla<DanosPropiedad> => ({
    clave,
    encabezado,
    alineacion: 'derecha',
    render: (f) => f[clave],
  });
  const columnas: ColumnaTabla<DanosPropiedad>[] = [
    {
      clave: 'propiedad',
      encabezado: t('reportes.col_propiedad'),
      render: (f) => f.propiedad_nombre,
    },
    numero('total', t('reportes.col_total')),
    numero('abiertos', t('danos.estados.abierto')),
    numero('en_reparacion', t('danos.estados.en_reparacion')),
    numero('resueltos', t('danos.estados.resuelto')),
    numero('urgentes', t('reportes.col_urgentes')),
  ];
  return (
    <Resultado
      consulta={consulta}
      render={(items) => (
        <Tabla
          columnas={columnas}
          filas={items}
          obtenerClave={(f) => f.propiedad_id}
          tituloAccesible={t('reportes.tipo_danos')}
        />
      )}
    />
  );
}
