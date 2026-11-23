import { Edit2, KeyRound, Plus, Power } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type Idioma, type Rol, type TipoClave, type Usuario } from '@/api/esquemas';
import { useAuth } from '@/app/AuthProvider';
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
  useActualizarUsuario,
  useCambiarClaveUsuario,
  useCrearUsuario,
  useUsuarios,
} from './hooks';

const ROLES: Rol[] = ['empleado', 'supervisor', 'admin'];
const IDIOMAS: Idioma[] = ['es', 'en', 'pt'];

/** Mismas reglas que el backend (HU-02): contraseña ≥ 6, PIN de 4 a 6 dígitos solo para empleados. */
export function validarClave(clave: string, tipoClave: TipoClave, rol: Rol): string | null {
  if (tipoClave === 'pin' && rol !== 'empleado') {
    return 'usuarios.validacion.pin_solo_empleados';
  }
  if (tipoClave === 'pin' && !/^\d{4,6}$/.test(clave)) {
    return 'usuarios.validacion.pin_formato';
  }
  if (tipoClave === 'contrasena' && (clave.length < 6 || clave.length > 128)) {
    return 'usuarios.validacion.contrasena_corta';
  }
  return null;
}

const NombreSchema = z.string().trim().min(1).max(60);

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; usuario: Usuario }
  | { tipo: 'clave'; usuario: Usuario }
  | null;

export function UsuariosPage() {
  const { t } = useTranslation();
  const { usuario: actual } = useAuth();
  const esAdmin = actual?.rol === 'admin';
  const [filtroRol, setFiltroRol] = useState<Rol | ''>(esAdmin ? '' : 'empleado');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'exito'; mensaje: string } | null>(null);

  const usuariosQuery = useUsuarios({ rol: filtroRol || undefined });
  const actualizar = useActualizarUsuario();

  const cerrar = (mensajeExito?: string) => {
    setDialogo(null);
    if (mensajeExito) {
      setAviso({ tipo: 'exito', mensaje: mensajeExito });
    }
  };

  const alternarActivo = async (item: Usuario) => {
    setAviso(null);
    try {
      await actualizar.mutateAsync({ usuarioId: item.id, cambios: { activo: !item.activo } });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: traducirError(err, t) });
    }
  };

  const columnas: ColumnaTabla<Usuario>[] = [
    {
      clave: 'nombre',
      encabezado: t('usuarios.nombre_usuario'),
      render: (fila) => (
        <span className="font-semibold text-slate-900 dark:text-white">{fila.nombre_usuario}</span>
      ),
    },
    { clave: 'rol', encabezado: t('usuarios.rol'), render: (f) => t(`roles.${f.rol}`) },
    {
      clave: 'tipo_clave',
      encabezado: t('usuarios.tipo_clave'),
      render: (f) =>
        f.tipo_clave === 'pin' ? t('usuarios.tipo_pin') : t('usuarios.tipo_contrasena'),
    },
    { clave: 'idioma', encabezado: t('usuarios.idioma'), render: (f) => t(`idiomas.${f.idioma}`) },
    {
      clave: 'estado',
      encabezado: t('usuarios.estado'),
      render: (f) => <InsigniaEstado estado={f.activo ? 'activo' : 'inactivo'} />,
    },
    {
      clave: 'acciones',
      encabezado: t('comun.acciones'),
      alineacion: 'derecha',
      render: (fila) => {
        const esPropio = fila.id === actual?.id;
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {esAdmin && (
              <Boton
                variante="secundario"
                icono={<Edit2 className="h-4 w-4" />}
                onClick={() => {
                  setDialogo({ tipo: 'editar', usuario: fila });
                }}
              >
                {t('comun.editar')}
              </Boton>
            )}
            {!esPropio && (
              <Boton
                variante="secundario"
                icono={<KeyRound className="h-4 w-4" />}
                onClick={() => {
                  setDialogo({ tipo: 'clave', usuario: fila });
                }}
              >
                {t('usuarios.restablecer_clave')}
              </Boton>
            )}
            {esAdmin && (
              <Boton
                variante="fantasma"
                disabled={esPropio || actualizar.isPending}
                title={esPropio ? t('usuarios.aviso_propio') : undefined}
                icono={<Power className="h-4 w-4" />}
                onClick={() => void alternarActivo(fila)}
              >
                {fila.activo ? t('usuarios.desactivar') : t('usuarios.activar')}
              </Boton>
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
            {esAdmin ? t('usuarios.titulo') : t('usuarios.titulo_supervisor')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {esAdmin ? t('usuarios.subtitulo') : t('usuarios.subtitulo_supervisor')}
          </p>
        </div>
        {esAdmin && (
          <Boton
            variante="primario"
            icono={<Plus className="h-4 w-4" />}
            onClick={() => {
              setDialogo({ tipo: 'crear' });
            }}
          >
            {t('usuarios.nuevo')}
          </Boton>
        )}
      </header>

      {esAdmin && (
        <section className="max-w-xs">
          <Selector
            etiqueta={t('usuarios.filtrar_rol')}
            value={filtroRol}
            opcionVacia={t('usuarios.todos_roles')}
            opciones={ROLES.map((r) => ({ valor: r, texto: t(`roles.${r}`) }))}
            onChange={(e) => {
              setFiltroRol(e.target.value as Rol | '');
            }}
          />
        </section>
      )}

      {aviso && <NotificacionEstado tipo={aviso.tipo} mensaje={aviso.mensaje} />}

      {usuariosQuery.isPending ? (
        <Cargando />
      ) : usuariosQuery.isError ? (
        <ErrorPantalla
          error={usuariosQuery.error}
          alReintentar={() => {
            void usuariosQuery.refetch();
          }}
        />
      ) : usuariosQuery.data.items.length === 0 ? (
        <Vacio titulo={t('usuarios.vacio_titulo')} descripcion={t('usuarios.vacio_descripcion')} />
      ) : (
        <Tabla
          columnas={columnas}
          filas={usuariosQuery.data.items}
          obtenerClave={(fila) => fila.id}
          tituloAccesible={t('usuarios.titulo')}
        />
      )}

      <Modal
        abierto={dialogo !== null}
        titulo={
          dialogo?.tipo === 'crear'
            ? t('usuarios.nuevo')
            : dialogo?.tipo === 'editar'
              ? t('usuarios.editar')
              : t('usuarios.restablecer_clave_de', {
                  nombre: dialogo?.usuario.nombre_usuario ?? '',
                })
        }
        alCerrar={() => {
          cerrar();
        }}
      >
        {dialogo?.tipo === 'crear' && (
          <FormularioCrear
            alTerminar={() => {
              cerrar(t('usuarios.creado'));
            }}
            alCancelar={() => {
              cerrar();
            }}
          />
        )}
        {dialogo?.tipo === 'editar' && (
          <FormularioEditar
            usuario={dialogo.usuario}
            esPropio={dialogo.usuario.id === actual?.id}
            alTerminar={() => {
              cerrar(t('usuarios.actualizado'));
            }}
            alCancelar={() => {
              cerrar();
            }}
          />
        )}
        {dialogo?.tipo === 'clave' && (
          <FormularioClave
            usuario={dialogo.usuario}
            alTerminar={() => {
              cerrar(t('usuarios.clave_restablecida'));
            }}
            alCancelar={() => {
              cerrar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

interface PropsFormulario {
  alTerminar: () => void;
  alCancelar: () => void;
}

function BotonesFormulario({
  cargando,
  alCancelar,
}: {
  cargando: boolean;
  alCancelar: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
      <Boton type="submit" variante="primario" anchoCompleto cargando={cargando}>
        {cargando ? t('usuarios.guardando') : t('usuarios.guardar')}
      </Boton>
      <Boton variante="secundario" anchoCompleto disabled={cargando} onClick={alCancelar}>
        {t('comun.cancelar')}
      </Boton>
    </div>
  );
}

function CamposClave({
  rol,
  tipoClave,
  clave,
  alCambiarTipo,
  alCambiarClave,
}: {
  rol: Rol;
  tipoClave: TipoClave;
  clave: string;
  alCambiarTipo: (tipo: TipoClave) => void;
  alCambiarClave: (clave: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Selector
        etiqueta={t('usuarios.tipo_clave')}
        value={tipoClave}
        opciones={[
          { valor: 'contrasena', texto: t('usuarios.tipo_contrasena') },
          ...(rol === 'empleado' ? [{ valor: 'pin', texto: t('usuarios.tipo_pin') }] : []),
        ]}
        onChange={(e) => {
          alCambiarTipo(e.target.value as TipoClave);
        }}
      />
      <Campo
        etiqueta={t('usuarios.clave')}
        ayuda={tipoClave === 'pin' ? t('usuarios.ayuda_pin') : t('usuarios.ayuda_contrasena')}
        type="password"
        autoComplete="new-password"
        value={clave}
        maxLength={tipoClave === 'pin' ? 6 : 128}
        inputMode={tipoClave === 'pin' ? 'numeric' : 'text'}
        onChange={(e) => {
          alCambiarClave(e.target.value);
        }}
      />
    </>
  );
}

function FormularioCrear({ alTerminar, alCancelar }: PropsFormulario) {
  const { t } = useTranslation();
  const crear = useCrearUsuario();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('empleado');
  const [tipoClave, setTipoClave] = useState<TipoClave>('contrasena');
  const [clave, setClave] = useState('');
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [error, setError] = useState<string | null>(null);

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const nombreValido = NombreSchema.safeParse(nombre);
    if (!nombreValido.success) {
      setError(t('usuarios.validacion.nombre_requerido'));
      return;
    }
    const errorClave = validarClave(clave, tipoClave, rol);
    if (errorClave) {
      setError(t(errorClave));
      return;
    }
    try {
      await crear.mutateAsync({
        nombre_usuario: nombreValido.data,
        rol,
        tipo_clave: tipoClave,
        clave,
        idioma,
      });
      alTerminar();
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <Campo
        etiqueta={t('usuarios.nombre_usuario')}
        value={nombre}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <Selector
        etiqueta={t('usuarios.rol')}
        value={rol}
        opciones={ROLES.map((r) => ({ valor: r, texto: t(`roles.${r}`) }))}
        onChange={(e) => {
          const nuevoRol = e.target.value as Rol;
          setRol(nuevoRol);
          if (nuevoRol !== 'empleado') {
            setTipoClave('contrasena');
          }
        }}
      />
      <CamposClave
        rol={rol}
        tipoClave={tipoClave}
        clave={clave}
        alCambiarTipo={setTipoClave}
        alCambiarClave={setClave}
      />
      <Selector
        etiqueta={t('usuarios.idioma')}
        value={idioma}
        opciones={IDIOMAS.map((i) => ({ valor: i, texto: t(`idiomas.${i}`) }))}
        onChange={(e) => {
          setIdioma(e.target.value as Idioma);
        }}
      />
      <BotonesFormulario cargando={crear.isPending} alCancelar={alCancelar} />
    </form>
  );
}

function FormularioEditar({
  usuario,
  esPropio,
  alTerminar,
  alCancelar,
}: PropsFormulario & { usuario: Usuario; esPropio: boolean }) {
  const { t } = useTranslation();
  const actualizar = useActualizarUsuario();
  const [nombre, setNombre] = useState(usuario.nombre_usuario);
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [idioma, setIdioma] = useState<Idioma>(usuario.idioma);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const nombreValido = NombreSchema.safeParse(nombre);
    if (!nombreValido.success) {
      setError(t('usuarios.validacion.nombre_requerido'));
      return;
    }
    if (rol !== usuario.rol && usuario.tipo_clave === 'pin' && rol !== 'empleado') {
      setError(t('usuarios.validacion.cambiar_pin_antes'));
      return;
    }
    const cambios = {
      ...(nombreValido.data !== usuario.nombre_usuario
        ? { nombre_usuario: nombreValido.data }
        : {}),
      ...(rol !== usuario.rol ? { rol } : {}),
      ...(idioma !== usuario.idioma ? { idioma } : {}),
    };
    if (Object.keys(cambios).length === 0) {
      alCancelar();
      return;
    }
    try {
      await actualizar.mutateAsync({ usuarioId: usuario.id, cambios });
      alTerminar();
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <Campo
        etiqueta={t('usuarios.nombre_usuario')}
        value={nombre}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <Selector
        etiqueta={t('usuarios.rol')}
        value={rol}
        disabled={esPropio}
        opciones={ROLES.map((r) => ({ valor: r, texto: t(`roles.${r}`) }))}
        onChange={(e) => {
          setRol(e.target.value as Rol);
        }}
      />
      {esPropio && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('usuarios.aviso_propio')}</p>
      )}
      {usuario.rol === 'supervisor' && rol !== 'supervisor' && (
        <NotificacionEstado tipo="info" mensaje={t('usuarios.aviso_quita_propiedades')} />
      )}
      <Selector
        etiqueta={t('usuarios.idioma')}
        value={idioma}
        opciones={IDIOMAS.map((i) => ({ valor: i, texto: t(`idiomas.${i}`) }))}
        onChange={(e) => {
          setIdioma(e.target.value as Idioma);
        }}
      />
      <BotonesFormulario cargando={actualizar.isPending} alCancelar={alCancelar} />
    </form>
  );
}

function FormularioClave({
  usuario,
  alTerminar,
  alCancelar,
}: PropsFormulario & { usuario: Usuario }) {
  const { t } = useTranslation();
  const cambiarClave = useCambiarClaveUsuario();
  const [tipoClave, setTipoClave] = useState<TipoClave>(usuario.tipo_clave);
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enviar = async (evento: SubmitEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const errorClave = validarClave(clave, tipoClave, usuario.rol);
    if (errorClave) {
      setError(t(errorClave));
      return;
    }
    try {
      await cambiarClave.mutateAsync({ usuarioId: usuario.id, clave, tipo_clave: tipoClave });
      alTerminar();
    } catch (err) {
      setError(traducirError(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      {error && <NotificacionEstado tipo="error" mensaje={error} />}
      <NotificacionEstado tipo="info" mensaje={t('usuarios.aviso_restablecer')} />
      <CamposClave
        rol={usuario.rol}
        tipoClave={tipoClave}
        clave={clave}
        alCambiarTipo={setTipoClave}
        alCambiarClave={setClave}
      />
      <BotonesFormulario cargando={cambiarClave.isPending} alCancelar={alCancelar} />
    </form>
  );
}
