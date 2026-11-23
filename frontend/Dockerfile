# syntax=docker/dockerfile:1

# Etapa 1: compila la PWA (Vite + service worker de Workbox).
FROM node:24-alpine AS construccion
RUN npm install --global pnpm@12.21.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV VITE_API_URL=/api
RUN pnpm build

# Etapa 2: Caddy sirve los archivos estáticos, hace de proxy hacia la API y gestiona HTTPS.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=construccion /app/dist /srv
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:2019/config/"]
