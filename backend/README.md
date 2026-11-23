# Backend

API en FastAPI. Las capas y los estándares están en `../CLAUDE.md`. Corre en local contra PostgreSQL o completo con Docker Compose (ver `../README.md`).

Requisitos: PostgreSQL 18 local, Python 3.14 y [uv](https://docs.astral.sh/uv/).

## Entorno

El entorno virtual vive fuera de OneDrive, en `%USERPROFILE%\.venvs\limpieza-backend`. En PyCharm, ese es el intérprete del proyecto; su terminal lo activa sola.

Para instalar o actualizar dependencias, desde `backend/` y con el entorno activo:

```powershell
uv sync --active
```

La primera vez, copia `.env.example` como `.env` y completa sus valores. La base `limpieza` y los roles `limpieza_owner` y `limpieza_app` se crean una vez en PostgreSQL.

## Correr

Desde `backend/`:

```powershell
alembic upgrade head
python -m scripts.semilla
uvicorn app.main:create_app --factory --reload --port 8000
```

La semilla solo hace falta la primera vez; crea las empresas `ANDINO` y `SUR` con sus usuarios. La API queda en <http://localhost:8000> y su documentación en <http://localhost:8000/docs>.

## Revisar el código

```powershell
ruff format --check .
ruff check .
mypy app tests migrations scripts
pytest --cov=app/services
```

Las pruebas de integración (`tests/integration`) usan una base PostgreSQL desechable con los roles y RLS reales. Levántala una vez desde la raíz del proyecto y define `TEST_DATABASE_URL` y `TEST_MIGRATION_DATABASE_URL` en `.env` (ver `.env.example`); sin ellas esas pruebas se omiten:

```powershell
docker compose -f ..\docker-compose.test.yml up -d --wait
```

## Crear una migración

```powershell
alembic revision -m "descripcion"
alembic upgrade head
```
