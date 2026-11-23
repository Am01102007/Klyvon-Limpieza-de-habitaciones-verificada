# App de limpieza de habitaciones — contexto del proyecto

Este archivo resume todo lo decidido en la fase de diseño. La especificación completa está en `docs/especificacion/main.tex` (fuente LaTeX, compila en Overleaf) y `docs/especificacion/especificacion.pdf`. Si algo de este archivo choca con la especificación, manda la especificación y hay que corregir este archivo.

## Qué es

Aplicación **web responsive** (instalable como PWA, sin tiendas de apps) para registrar y verificar la limpieza de habitaciones de hoteles pequeños y alquileres vacacionales (Airbnb). Cada limpieza deja evidencia: **foto de entrada → reporte de daños → tiempo medido automáticamente → foto de salida**. Proyecto académico: el documento se presenta a un profesor.

Enfoque: clientes en el extranjero, por eso multi-idioma (español, inglés, portugués) y zona horaria por propiedad.

## Roles

- **Administrador**: acceso a todo. Crea usuarios, propiedades y habitaciones; configura la empresa (idioma, zona horaria, regla de revisión, retención de fotos); ve reportes. Usa sobre todo la vista de escritorio.
- **Supervisor**: asigna habitaciones, revisa limpiezas (aprueba/rechaza con comentario), gestiona daños, ve reportes de su grupo. Vista de celular.
- **Empleado**: ve sus habitaciones del día y hace la limpieza. Vista de celular.

Usuarios se crean **solo con nombre y contraseña** (sin correo). El login pide **código de empresa + usuario + contraseña o PIN**. El nombre de usuario es único dentro de la empresa. La recuperación de contraseña la hace el admin o el supervisor. Bloqueo de 15 min tras 5 intentos fallidos.

## Flujo de una limpieza (decisiones clave)

1. El empleado abre la habitación → cámara en vivo (nunca galería). **La primera foto de entrada arranca el cronómetro.**
2. ¿Hay daños? Sí/No. Si sí: foto + categoría + gravedad (leve/urgente) + nota opcional.
3. Limpia; puede **pausar con motivo** (el tiempo pausado no cuenta).
4. **La última foto de salida detiene el cronómetro** y la limpieza queda *Enviada*.
5. **La revisión es asíncrona**: el empleado NO espera al supervisor; la siguiente habitación se desbloquea al instante.
6. El sistema decide si requiere revisión según la regla de la empresa: **todo**, **muestra** (1 de cada N) o **riesgo** (empleado nuevo de < 2 semanas, daño reportado, o limpieza 40 % más rápida que el promedio de esa habitación).
7. Si el supervisor rechaza (comentario obligatorio), se crea una **limpieza de corrección** que vuelve a la lista del empleado y se mide aparte.

Reglas: hora y duración siempre las calcula **el servidor** (duración neta = fin − inicio − pausas), nunca el cliente. Un empleado no puede tener dos limpiezas abiertas. Fotos comprimidas a < 500 KB. Modo sin conexión obligatorio.

Estados en dos ejes: trabajo (Pendiente → En curso → Enviada) y revisión (Sin revisión requerida / Por revisar / Aprobada / Rechazada).

## Stack (mismo que el proyecto Apartaestudios: Python + React)

- **Frontend**: React + TypeScript + Vite, TanStack Query, PWA (vite-plugin-pwa), service worker + IndexedDB (Workbox, Dexie) para modo offline, i18next.
- **Backend**: Python + **FastAPI** (Pydantic, JWT, Argon2), Uvicorn en Docker. En desarrollo también corre sin Docker, contra PostgreSQL local.
- **Datos**: PostgreSQL, SQLAlchemy + Alembic. Aislamiento por `empresa_id` en cada consulta (dependencia de FastAPI) + RLS en PostgreSQL como segunda barrera.
- **Fotos**: S3 o compatible en el despliegue, con URLs firmadas. Por ahora, carpeta local detrás de la interfaz `AlmacenFotos`.
- **Tareas programadas**: APScheduler (borrado diario de fotos vencidas, salvo las de daños abiertos).
- **Push**: Web Push (pywebpush, VAPID).
- **Pruebas**: pytest (+ pytest-cov), TestClient de FastAPI, Vitest + React Testing Library, Playwright, Locust, OWASP ZAP. CI en GitHub Actions.

## Modelo de datos (13 tablas, PostgreSQL)

IDs `UUID`, fechas con hora `TIMESTAMPTZ`. Además de las columnas listadas, todas las tablas salvo `empresa` llevan `empresa_id`, con claves foráneas compuestas que impiden mezclar empresas.

- `empresa`: id, nombre, codigo (UQ), idioma, plan, regla_revision (todo/muestra/riesgo), muestra_n, retencion_fotos_dias, creado_en
- `usuario`: id, empresa_id, nombre_usuario, hash_clave, tipo_clave (contraseña/pin), rol (admin/supervisor/empleado), idioma, activo, intentos_fallidos, bloqueado_hasta, creado_en — UQ (empresa_id, nombre_usuario)
- `propiedad`: id, empresa_id, nombre, tipo (hotel/airbnb), direccion, zona_horaria
- `supervisor_propiedad`: usuario_id, propiedad_id (PK compuesta)
- `habitacion`: id, propiedad_id, nombre, tipo, fotos_min_entrada, fotos_min_salida, activa — UQ (propiedad_id, nombre)
- `asignacion`: id, habitacion_id, empleado_id, asignado_por, fecha, prioridad, hora_limite
- `limpieza`: id, asignacion_id, empleado_id, tipo (normal/correccion), limpieza_origen_id, inicio, fin, duracion_neta_seg, estado_trabajo (pendiente/en_curso/enviada), requiere_revision, estado_revision. Nace pendiente al asignar.
- `pausa`: id, limpieza_id, motivo, inicio, fin
- `revision`: id, limpieza_id (UQ), supervisor_id, resultado, comentario, revisado_en
- `dano`: id, limpieza_id, categoria, gravedad, nota, estado (abierto/en_reparacion/resuelto), creado_en
- `dano_historial`: id, dano_id, usuario_id, estado_anterior, estado_nuevo, cambiado_en
- `foto`: id, limpieza_id, dano_id (nullable), momento (entrada/salida/dano), url, tomada_en, tamano_kb
- `refresh_token`: id, usuario_id, hash_token (UQ), expira_en, revocado_en, creado_en

En el código, `Usuario` es clase abstracta con `Empleado`, `Supervisor` y `Administrador` (herencia de tabla única por `rol`). Ver el diagrama de clases en la especificación.

## Endpoints principales previstos

`/auth/login`, `/asignaciones/hoy`, `/limpiezas/{id}/iniciar`, `/limpiezas/{id}/pausas`, `/limpiezas/{id}/danos`, `/limpiezas/{id}/finalizar`, `/revisiones`, `/reportes`. La lista completa está en `/docs`.

## Alcance del MVP

Dentro: login, propiedades/habitaciones, asignación diaria, fotos + cronómetro, daños, revisión asíncrona, panel del admin, 3 idiomas, offline, reportes de tiempos y daños, exportar reportes a PDF.
Fuera (v2/v3): checklist por habitación, notificaciones push, exportar a Excel, sincronizar calendarios Airbnb/Booking, inventario, pagos, IA de comparación de fotos, integración PMS, apps nativas.

Requisitos (RF-01…RF-18, RNF-01…RNF-11), historias de usuario (HU-01…HU-16), casos de uso (CU-01…CU-15) y casos de prueba (CP-01…CP-26) están numerados en la especificación; usar esos IDs en commits, issues y pruebas.

## Plan por fases (sin fechas)

1. **Diseño** — prototipo de pantallas (vista celular y escritorio), validar requisitos. ← la especificación ya está; falta el prototipo.
2. **Backend, API y BD** — FastAPI + Docker, modelos SQLAlchemy, migraciones Alembic, auth, servicios de limpieza/revisión/daños, subida de fotos.
3. **Frontend** — React + Vite, vistas por rol, cámara, cronómetro, offline, PWA, traducciones.
4. **Pruebas** — ejecutar el plan de pruebas de la especificación.
5. **Despliegue** — AWS EC2 (Free Tier) con Docker Compose: `db` (PostgreSQL), `migrate` (Alembic), `api` (FastAPI) y `web` (Caddy: PWA, proxy `/api` y HTTPS automático). Guía en `docs/despliegue/`. HTTPS obligatorio (la cámara del navegador lo exige).

## Riesgo técnico a vigilar

Safari en iPhone: la cámara y el modo offline deben probarse temprano. Safari no sincroniza en segundo plano y Web Push solo funciona con la PWA instalada (iOS 16.4+).

## Convenciones

- Todo el texto de la interfaz pasa por i18next (nunca textos fijos en componentes).
- Documentación y mensajes al usuario en español.
- Si se cambia una decisión de diseño, actualizar este archivo y la especificación.

## Estándares de ingeniería (obligatorios)

Eres el desarrollador principal de este proyecto. Prioridades, en orden: seguridad, correctitud de los datos, código limpio y simple. Antes de escribir código, lee este archivo y la especificación en `docs/especificacion/main.tex`.

### Forma de trabajar
- Trabaja por incrementos pequeños: una funcionalidad completa (modelo, migración, servicio, endpoint, pruebas) por vez, ligada a sus IDs de la especificación (RF, HU, CU, CP).
- Antes de una decisión de arquitectura o de agregar una dependencia nueva, explícame la opción y por qué; no instales librerías sin justificarlo.
- Cada funcionalidad se entrega con sus pruebas pasando. No marques algo como terminado si las pruebas, el linter o el chequeo de tipos fallan.
- Si una instrucción mía contradice estos estándares o la especificación, avísame antes de seguir.

### Arquitectura por capas
Backend (Python + FastAPI), estructura:
```
backend/app/
  api/            # routers, schemas Pydantic de entrada/salida, dependencias (auth, sesión)
  services/       # reglas de negocio y casos de uso; no conocen FastAPI ni HTTP
  repositories/   # acceso a datos con SQLAlchemy; sin reglas de negocio
  models/         # modelos SQLAlchemy (tablas)
  core/           # configuración, seguridad, sesión de BD, logging, excepciones
backend/migrations/  # Alembic
backend/tests/       # unit/ e integration/
```
- Las dependencias van en un solo sentido: `api → services → repositories → models`. Ninguna capa importa una capa superior.
- Los routers solo validan entrada, llaman a un servicio y devuelven un schema. Nada de lógica de negocio ni consultas SQL en los routers.
- Los servicios lanzan excepciones de dominio propias (`core/exceptions.py`); un manejador central las traduce a códigos HTTP.
- Nunca devuelvas modelos SQLAlchemy desde la API: siempre schemas Pydantic de salida explícitos (evita filtrar campos como `hash_clave`).
- Las dependencias (sesión, repositorios, servicios) se inyectan con `Depends` de FastAPI.

Frontend (React + TypeScript + Vite), estructura:
```
frontend/src/
  features/<dominio>/   # pantallas, componentes y hooks de cada dominio (auth, limpiezas, revision, ...)
  api/                  # cliente HTTP y funciones por recurso; único lugar que llama a la API
  components/           # componentes visuales reutilizables, sin lógica de negocio
  offline/              # service worker, IndexedDB y cola de sincronización
  i18n/                 # traducciones es / en / pt
```
- Los componentes no hacen `fetch`: usan hooks que llaman a la capa `api/`. Estado del servidor con TanStack Query.
- TypeScript en modo `strict`; prohibido `any`.

### SOLID, aplicado con criterio
- **S**: cada clase o módulo tiene una sola razón para cambiar (un servicio por agregado: `LimpiezaService`, `RevisionService`, `DanoService`, ...).
- **O**: las reglas de revisión (todo, muestra, riesgo) se implementan como estrategias intercambiables, no con `if` encadenados.
- **L**: `Empleado`, `Supervisor` y `Administrador` deben poder usarse donde se espera un `Usuario`.
- **I**: interfaces pequeñas (`Protocol` de Python) solo donde haya más de una implementación real o se necesite simular en pruebas (por ejemplo, el almacenamiento de fotos: S3 en producción, MinIO o memoria en pruebas).
- **D**: los servicios dependen de abstracciones del almacenamiento de fotos y del reloj (para probar tiempos), no de clientes concretos.

### KISS
- La solución más simple que cumpla el requisito. Sin patrones, capas ni abstracciones "por si acaso".
- No crear una interfaz si solo existe una implementación y no hace falta simularla en pruebas.
- Funciones cortas, nombres claros en español para el dominio (`limpieza`, `asignacion`), sin comentarios que repitan el código.
- Nada de código muerto, archivos vacíos ni funcionalidades fuera del MVP.

### Seguridad
- Contraseñas y PIN con **Argon2id** (argon2-cffi). Nunca en texto plano ni en logs.
- **Access token JWT corto (15 min)** y **refresh token en cookie `HttpOnly`, `Secure`, `SameSite=Strict`**, rotado en cada uso y revocable. No guardar tokens en `localStorage`.
- Bloqueo tras 5 intentos fallidos por 15 min y **rate limiting** en login y endpoints sensibles (slowapi).
- **Autorización en cada endpoint**: rol + pertenencia a la empresa. Todo acceso filtra por `empresa_id` del token, nunca por un `empresa_id` que venga del cliente. Un recurso de otra empresa responde **404** (no revelar que existe).
- Segunda barrera: **Row Level Security** en PostgreSQL por `empresa_id`.
- Validación estricta de toda entrada con Pydantic (`extra="forbid"`, longitudes y rangos máximos).
- Fotos: validar tipo real por contenido (no por extensión), tamaño máximo, re-codificar la imagen en el servidor y eliminar metadatos EXIF. Guardar en bucket privado y servir solo con **URLs firmadas** de corta duración.
- Hora y duración solo del servidor; ignorar cualquier valor de tiempo enviado por el cliente.
- CORS con lista explícita de orígenes; cabeceras de seguridad (HSTS, CSP, X-Content-Type-Options, frame-ancestors).
- Secretos solo por variables de entorno (`pydantic-settings`); `.env` nunca en git; entregar `.env.example`.
- Mensajes de error genéricos al cliente; detalle solo en logs del servidor, sin datos personales ni tokens.
- Revisar contra OWASP Top 10 y OWASP API Security Top 10. Dependencias auditadas (`pip-audit`, `npm audit`) en CI.

### Base de datos
- PostgreSQL. **Todo cambio de esquema por migración Alembic**, revisada a mano; nunca `create_all` ni cambios manuales.
- La integridad vive en la base: `NOT NULL`, `FOREIGN KEY` con `ON DELETE` explícito, `UNIQUE`, `CHECK` (por ejemplo `fin > inicio`, `fotos_min >= 1`) y tipos enumerados.
- IDs `UUID`; fechas con hora `TIMESTAMPTZ` guardadas en UTC; la zona horaria de la propiedad solo se aplica al mostrar.
- Índices para cada consulta frecuente y cada clave foránea (mínimo: `asignacion(empleado_id, fecha)`, `limpieza(estado_revision)`, `foto(tomada_en)`, `dano(estado)`). Verificar planes con `EXPLAIN ANALYZE` en las consultas de reportes.
- Transacciones explícitas en operaciones de varios pasos (finalizar limpieza = cerrar limpieza + calcular duración + decidir revisión, todo o nada).
- Evitar el problema N+1 (`selectinload` / `joinedload`); seleccionar solo las columnas necesarias; paginar todo listado.
- Solo consultas parametrizadas del ORM; prohibido armar SQL concatenando texto.
- Restricción a nivel de BD para que un empleado no tenga dos limpiezas abiertas (índice único parcial).
- Sesión de BD por petición con pool de conexiones; nada de sesiones globales.
- Datos semilla para desarrollo y pruebas en un script aparte, nunca en las migraciones.

### Calidad y pruebas
- Python: `ruff` (lint y formato) y `mypy --strict`, tipado completo.
- Frontend: ESLint + Prettier, TypeScript `strict`.
- Pruebas según el plan de la especificación: unitarias de servicios (sin BD), de integración con PostgreSQL real en Docker, E2E con Playwright. Cobertura mínima del 80 % en `services/`.
- Cada caso de prueba lleva el ID del plan (CP-xx) en su nombre o docstring.
- GitHub Actions corre lint, tipos, pruebas y auditoría de dependencias en cada push; si algo falla, no se integra.
- Commits pequeños con mensajes claros que referencien el requisito (ejemplo: `feat(limpieza): calcular duración neta [RF-09]`).
