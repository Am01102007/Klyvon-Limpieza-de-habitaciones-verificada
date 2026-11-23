# Klyvon · App de limpieza de habitaciones

Aplicación web responsive (PWA instalable, con modo sin conexión) para registrar y verificar la limpieza de habitaciones de hoteles pequeños y alquileres vacacionales: foto de entrada, reporte de daños, tiempo medido por el servidor y foto de salida, con revisión asíncrona y roles de administrador, supervisor y empleado. Español, inglés y portugués.

| Carpeta | Contenido |
| --- | --- |
| `backend/` | API en Python 3.14 + FastAPI, SQLAlchemy, Alembic, PostgreSQL con RLS. Ver `backend/README.md`. |
| `frontend/` | PWA en React 19 + TypeScript strict + Vite, TanStack Query, Dexie (cola offline), i18next. Ver `frontend/README.md`. |
| `docs/especificacion/` | Especificación completa (LaTeX y PDF): requisitos RF/RNF, HU, CU y plan de pruebas CP. |
| `docs/despliegue/` | Guía paso a paso para GitHub y AWS EC2 (Free Tier). |
| `CLAUDE.md` | Contexto, decisiones y estándares de ingeniería del proyecto. |

## Arranque rápido con Docker

```bash
cp .env.example .env        # y completa los secretos (openssl rand -hex 32)
docker compose up -d --build --wait
docker compose run --rm migrate python -m scripts.semilla   # datos de demostración (opcional)
```

La app queda en <http://localhost>. Caddy sirve la PWA, hace de proxy de la API en `/api` y, con un dominio real en `DOMINIO`, obtiene el certificado HTTPS solo.

| Servicio | Imagen | Función |
| --- | --- | --- |
| `db` | `postgres:18-alpine` | Datos, con volumen persistente y roles `limpieza_owner` / `limpieza_app` |
| `migrate` | `limpieza-api` | Corre `alembic upgrade head` una vez y termina |
| `api` | `limpieza-api` (Python slim, multi-stage) | FastAPI con Uvicorn, usuario sin privilegios |
| `web` | `limpieza-web` (Caddy alpine, multi-stage) | PWA estática, proxy, cabeceras de seguridad y HTTPS |

## Pruebas

```bash
# Backend: unitarias + integración contra PostgreSQL real
docker compose -f docker-compose.test.yml up -d --wait
cd backend && uv run pytest --cov=app/services

# Frontend: unitarias, E2E simuladas (escritorio, Android, iPhone) y E2E del stack real
cd frontend && pnpm test && pnpm test:e2e
E2E_URL=http://localhost E2E_CLAVE=<SEMILLA_CLAVE> pnpm test:e2e:stack
```

GitHub Actions (`.github/workflows/ci.yml`) corre en cada push: ruff, mypy `--strict`, pytest con cobertura mínima del 80 % en `services/`, ESLint, TypeScript, Vitest, build, Playwright, `pip-audit`, `pnpm audit` y el stack completo de Docker con sus E2E.
