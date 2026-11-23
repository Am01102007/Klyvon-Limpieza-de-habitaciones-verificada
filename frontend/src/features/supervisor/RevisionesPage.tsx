import { Building2, Clock, Eye, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { type EstadoRevision } from '@/api/esquemas';
import { Boton } from '@/components/Boton';
import { Cargando } from '@/components/Cargando';
import { ErrorPantalla } from '@/components/ErrorPantalla';
import { InsigniaEstado, type TipoInsigniaEstado } from '@/components/InsigniaEstado';
import { Campo } from '@/components/Campo';
import { Paginador } from '@/components/Paginador';
import { Selector } from '@/components/Selector';
import { Vacio } from '@/components/Vacio';
import { formatearDuracionMinutos } from '@/utils/fecha';

import { useEmpleadosCatalogo, useLimpiezas, usePropiedadesCatalogo } from './hooks';

const LIMITE = 50;

function insigniaDesdeRevision(estado: EstadoRevision): TipoInsigniaEstado {
  switch (estado) {
    case 'pendiente':
      return 'por_revisar';
    case 'aprobada':
      return 'aprobada';
    case 'rechazada':
      return 'rechazada';
    case 'no_requerida':
      return 'no_requerida';
  }
}

export function RevisionesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const baseRuta = location.pathname.startsWith('/admin') ? '/admin' : '/supervisor';

  const [estadoRevision, setEstadoRevision] = useState<EstadoRevision>('pendiente');
  const [propiedadId, setPropiedadId] = useState<string>('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const empleados = useEmpleadosCatalogo().data?.items ?? [];
  const [desplazamiento, setDesplazamiento] = useState(0);

  const propiedadesQuery = usePropiedadesCatalogo();
  const propiedades = propiedadesQuery.data?.items ?? [];
  const nombrePropiedad = new Map(propiedades.map((p) => [p.id, p.nombre]));

  const revisionesQuery = useLimpiezas({
    estadoRevision,
    propiedadId: propiedadId || undefined,
    empleadoId: empleadoId || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
    limite: LIMITE,
    desplazamiento,
  });

  if (revisionesQuery.isPending) {
    return <Cargando />;
  }

  if (revisionesQuery.isError) {
    return (
      <ErrorPantalla
        error={revisionesQuery.error}
        alReintentar={() => {
          void revisionesQuery.refetch();
        }}
      />
    );
  }

  const pagina = revisionesQuery.data;
  const items = pagina.items;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('revisiones.titulo')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('revisiones.subtitulo')}</p>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <Selector
          etiqueta={t('revisiones.filtrar_estado')}
          value={estadoRevision}
          onChange={(e) => {
            setEstadoRevision(e.target.value as EstadoRevision);
            setDesplazamiento(0);
          }}
          opciones={[
            { valor: 'pendiente', texto: t('estados.por_revisar') },
            { valor: 'aprobada', texto: t('estados.aprobada') },
            { valor: 'rechazada', texto: t('estados.rechazada') },
            { valor: 'no_requerida', texto: t('estados.no_requerida') },
          ]}
        />
        <Selector
          etiqueta={t('revisiones.filtrar_propiedad')}
          value={propiedadId}
          onChange={(e) => {
            setPropiedadId(e.target.value);
            setDesplazamiento(0);
          }}
          opcionVacia={t('revisiones.todas_propiedades')}
          opciones={propiedades.map((p) => ({ valor: p.id, texto: p.nombre }))}
        />
        <Selector
          etiqueta={t('asignaciones.empleado')}
          value={empleadoId}
          onChange={(e) => {
            setEmpleadoId(e.target.value);
            setDesplazamiento(0);
          }}
          opcionVacia={t('comun.todos')}
          opciones={empleados.map((u) => ({ valor: u.id, texto: u.nombre_usuario }))}
        />
        <Campo
          etiqueta={t('reportes.desde')}
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => {
            setDesde(e.target.value);
            setDesplazamiento(0);
          }}
        />
        <Campo
          etiqueta={t('reportes.hasta')}
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => {
            setHasta(e.target.value);
            setDesplazamiento(0);
          }}
        />
      </section>

      {items.length === 0 ? (
        <Vacio
          titulo={t('revisiones.vacio_titulo')}
          descripcion={t('revisiones.vacio_descripcion')}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {item.habitacion_nombre}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span>{nombrePropiedad.get(item.propiedad_id) ?? '—'}</span>
                    </p>
                  </div>
                  <InsigniaEstado estado={insigniaDesdeRevision(item.estado_revision)} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span>{item.empleado_nombre}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span>
                      {item.duracion_neta_seg !== null
                        ? formatearDuracionMinutos(item.duracion_neta_seg)
                        : t('revisiones.sin_duracion')}
                    </span>
                  </span>
                  {item.tipo === 'correccion' && (
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      {t('revisiones.correccion')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {item.fecha}
                </p>
              </div>

              <Boton
                variante="primario"
                anchoCompleto
                icono={<Eye className="h-4 w-4" />}
                onClick={() => {
                  void navigate(`${baseRuta}/revisiones/${item.id}`);
                }}
              >
                {t('revisiones.ver_detalle')}
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <Paginador
        desplazamiento={desplazamiento}
        limite={LIMITE}
        total={pagina.total}
        alCambiar={setDesplazamiento}
      />
    </div>
  );
}
