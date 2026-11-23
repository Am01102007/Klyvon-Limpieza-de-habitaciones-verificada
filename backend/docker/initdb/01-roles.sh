#!/bin/sh
# Crea los dos roles del proyecto la primera vez que arranca el volumen de PostgreSQL.
# limpieza_owner es dueño del esquema (migraciones y semilla); limpieza_app es el rol de la API,
# sin superusuario ni BYPASSRLS, para que las políticas RLS sí se apliquen (RNF-08).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v base="$POSTGRES_DB" -v clave_owner="$OWNER_PASSWORD" -v clave_app="$APP_PASSWORD" <<'SQL'
CREATE ROLE limpieza_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'clave_owner';
CREATE ROLE limpieza_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'clave_app';
ALTER DATABASE :"base" OWNER TO limpieza_owner;
REVOKE ALL ON DATABASE :"base" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"base" TO limpieza_app;
SQL
