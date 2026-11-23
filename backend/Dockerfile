# syntax=docker/dockerfile:1

# Etapa 1: instala las dependencias de producción con uv, sin herramientas de desarrollo.
FROM python:3.15-slim AS dependencias
COPY --from=ghcr.io/astral-sh/uv:0.12.17 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Etapa 2: imagen final sin uv ni compiladores, con usuario sin privilegios.
FROM python:3.15-slim
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FOTOS_DIR=/datos/fotos
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin api \
    && mkdir -p /datos/fotos \
    && chown api:api /datos/fotos
COPY --from=dependencias /opt/venv /opt/venv
WORKDIR /app
COPY alembic.ini ./
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
USER api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"]
# Un solo proceso: la tarea diaria de borrado de fotos corre dentro de la API (APScheduler)
# y con varios workers se ejecutaría varias veces. El puerto 8000 no se publica: solo Caddy
# llega aquí, por eso se confía en su cabecera X-Forwarded-For para el rate limiting.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
