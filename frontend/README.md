# Frontend · PWA

React 19 + TypeScript strict + Vite, con TanStack Query, Zod, Dexie (IndexedDB), Workbox (vite-plugin-pwa) e i18next en español, inglés y portugués.

## Desarrollo

Requisitos: Node.js 24 y pnpm. La API debe estar en `http://localhost:8000` (ver `../backend/README.md`).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

El servidor de Vite hace de proxy igual que Caddy en producción: `/api` → API sin el prefijo (y reescribe la ruta de la cookie de `/auth` a `/api/auth`), `/fotos` → URLs firmadas de la API. El service worker está apagado en desarrollo; la PWA se prueba con `pnpm build && pnpm preview` o con Docker.

| Script                                         | Qué hace                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | ESLint estricto con jsx-a11y, `tsc --noEmit`, Prettier                                       |
| `pnpm test`                                    | Vitest + Testing Library                                                                     |
| `pnpm test:e2e`                                | Playwright con la API simulada, en escritorio, Android (Pixel 7) e iPhone 14                 |
| `pnpm test:e2e:stack`                          | Playwright contra el stack de Docker, con cámara simulada (ver `playwright.stack.config.ts`) |
| `pnpm build`                                   | Compilación de producción con service worker y manifiesto                                    |

## Estructura

- `src/api/`: único lugar que llama a la API. Cliente `fetch` con renovación del token, esquemas Zod que validan cada respuesta y una función por recurso. `contrato.test.ts` fija rutas, métodos y cuerpos contra `backend/app/api`.
- `src/app/`: proveedores (sesión, preferencias, TanStack Query), guardas por rol, layouts de celular y escritorio, rutas.
- `src/features/<dominio>/`: pantallas y hooks de `auth`, `tareas`, `limpieza`, `supervisor` y `admin`.
- `src/components/`: componentes visuales reutilizables y accesibles, sin lógica de negocio.
- `src/offline/`: IndexedDB (Dexie), cola de sincronización y copias locales de la lista del día.
- `src/i18n/`: traducciones `es`, `en`, `pt`.

## Decisiones

- **Sesión.** El access token vive solo en memoria; el refresh va en cookie `HttpOnly`. Las renovaciones simultáneas entre pestañas se coordinan con `navigator.locks` y `BroadcastChannel`, y 15 minutos de inactividad cierran la sesión. En `localStorage` solo hay preferencias de interfaz (tema, tamaño de texto, contraste, idioma, código de empresa).
- **Cámara.** Solo `getUserMedia` en vivo, sin `<input type="file">` (RF-07, CP-09). La foto se comprime en `<canvas>` a JPEG de menos de 500 KB; el servidor la vuelve a validar y re-codificar.
- **Sin conexión (RNF-03).** Las acciones sin red se guardan en una cola de Dexie con ids generados en el teléfono (`fotoId`, `danoId`, `pausaId`); la API es idempotente por esos ids, así que reintentar no duplica. Sin red, 401, 429 o 5xx dejan la operación pendiente; cualquier otro rechazo queda visible con "Reintentar" y nunca se descarta en silencio. Cada operación lleva el usuario que la hizo y solo se envía con su sesión. La lista del día y el detalle de cada limpieza se guardan por usuario hasta 2 días para trabajar sin señal.
- **Service worker.** Solo precachea la app. No guarda respuestas de `/api` ni `/fotos`, para que datos de clientes y URLs firmadas no queden en la caché del navegador.
- **Hora.** El cronómetro de pantalla es solo visual; inicio, fin y duración neta los fija el servidor (RNF-06).

## Limitaciones conocidas del MVP

- No hay borrado de asignaciones ni desactivación de propiedades (la API no los ofrece).
- Limpiezas, asignaciones y daños traen `propiedad_id` sin el nombre: la pantalla lo toma de la lista de propiedades (máximo 100 por página).
- La zona horaria se configura por propiedad, no por empresa.
- La cámara del navegador solo funciona con HTTPS o en `localhost`: para probar en un celular hace falta el despliegue con HTTPS.
