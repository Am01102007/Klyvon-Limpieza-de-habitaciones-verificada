# Guía de despliegue: GitHub y AWS EC2 (Free Tier)

Klyvon · App de limpieza de habitaciones. Paso a paso con los comandos listos para copiar: subir el proyecto a GitHub, crear la instancia EC2, configurar Security Group y swap, levantar con Docker Compose y validar la app, la vista de celular y el modo sin conexión.

## 0. Qué vas a tener al final

- El código en un repositorio de GitHub, con GitHub Actions corriendo lint, tipos, pruebas, auditoría de dependencias y el stack de Docker en cada push.
- Una instancia EC2 pequeña (1 GB de RAM + 2 GB de swap) con cuatro contenedores: `db` (PostgreSQL 18), `migrate` (Alembic, corre una vez), `api` (FastAPI) y `web` (Caddy con la PWA).
- HTTPS automático con Let's Encrypt en una dirección tipo `https://3-15-20-7.sslip.io`. HTTPS es obligatorio: sin él el celular no abre la cámara y el navegador no guarda la cookie de sesión.

## 1. Antes de subir: revisión local

Desde la carpeta del proyecto en tu PC (PowerShell):

```
git status
git check-ignore -v .env backend/.env frontend/.env
```

Los tres `.env` deben aparecer como ignorados. Ningún secreto, `node_modules`, `dist` ni `_para_borrar` debe estar en la lista de `git status`.

Corre las pruebas una última vez:

```
docker compose -f docker-compose.test.yml up -d --wait
cd backend
uv run ruff check . ; uv run mypy app tests migrations scripts ; uv run pytest
cd ..\frontend
pnpm lint ; pnpm typecheck ; pnpm test ; pnpm test:e2e
```

## 2. Subir el proyecto a GitHub

### 2.1 Confirmar los cambios

Tu rama de trabajo es `feat/esqueleto-backend` y `main` solo tiene el commit de la documentación. Confirma todo en la rama y luego adelanta `main`:

```
git add -A
git status
git commit -m "feat: backend, frontend PWA, Docker y CI [RF-01..RF-18]"
git switch main
git merge --ff-only feat/esqueleto-backend
```

### 2.2 Crear el repositorio y hacer push

1. En GitHub: botón **New repository**. Nombre sugerido: `klyvon-limpieza`. Visibilidad **Private** (recomendado). No marques README, .gitignore ni licencia: el proyecto ya los trae.
2. Copia la URL que te da GitHub y ejecuta:

```
git remote add origin https://github.com/TU_USUARIO/klyvon-limpieza.git
git push -u origin main
git push -u origin feat/esqueleto-backend
```

3. En la pestaña **Actions** del repositorio verás correr el flujo **CI** con tres trabajos: Backend, Frontend y Docker compose + E2E. Los tres deben quedar en verde.
4. Recomendado: **Settings → Branches → Add branch ruleset** para `main` con *Require status checks to pass* (los tres trabajos de CI) y *Require a pull request before merging*.
5. Copia la descripción y los *topics* del documento de descripción del repositorio en **About → ⚙**.

## 3. Crear la instancia EC2

### 3.1 Cuenta y región

1. Entra a la consola de AWS. Arriba a la derecha elige una región cercana a tus clientes (por ejemplo `us-east-1`, Norte de Virginia, o `sa-east-1`, São Paulo).
2. Crea una alerta de costos antes de nada: **Billing and Cost Management → Budgets → Create budget → Zero spend budget**, con tu correo. Así te avisa si algo sale del Free Tier.

### 3.2 Lanzar la instancia

**EC2 → Instances → Launch instances**:

- **Name**: `klyvon-prod`
- **AMI**: *Ubuntu Server 24.04 LTS (HVM), SSD Volume Type*, 64-bit (x86). Debe decir *Free tier eligible*.
- **Instance type**: `t3.micro` (o `t2.micro` si tu cuenta lo muestra como *Free tier eligible*).
- **Key pair**: *Create new key pair* → nombre `klyvon-key`, tipo ED25519, formato `.pem`. Guarda el archivo en `C:\Users\TU_USUARIO\.ssh\`; no se puede volver a descargar.
- **Network settings → Edit**: crea un Security Group nuevo llamado `klyvon-sg` con las reglas de la sección 3.3.
- **Storage**: 20 GiB `gp3` (el Free Tier cubre hasta 30 GiB).
- **Launch instance**.

### 3.3 Security Group (reglas de entrada)

| Tipo | Protocolo | Puerto | Origen | Para qué |
| --- | --- | --- | --- | --- |
| SSH | TCP | 22 | My IP | Administrar la instancia, solo desde tu IP |
| HTTP | TCP | 80 | 0.0.0.0/0 y ::/0 | Validación de Let's Encrypt y redirección a HTTPS |
| HTTPS | TCP | 443 | 0.0.0.0/0 y ::/0 | La aplicación |
| Custom UDP | UDP | 443 | 0.0.0.0/0 y ::/0 | HTTP/3 (opcional, más rápido en celular) |

No abras 5432 (PostgreSQL) ni 8000 (API): solo Caddy está expuesto y los demás contenedores viven en una red interna de Docker. Las reglas de salida se dejan como vienen (todo permitido).

Si tu IP de casa cambia y SSH deja de conectar, edita la regla 22 y vuelve a elegir *My IP*.

### 3.4 IP fija (Elastic IP)

**EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**, luego **Actions → Associate Elastic IP address** con la instancia `klyvon-prod`. Así la dirección (y el dominio sslip.io) no cambia al apagar y prender. AWS cobra las IPv4 públicas fuera de los beneficios del Free Tier de tu cuenta; revisa tu presupuesto. Si liberas la instancia, libera también la Elastic IP.

Anota la IP, por ejemplo `3.15.20.7`. Tu dominio será esa IP con guiones: `3-15-20-7.sslip.io` (sslip.io resuelve cualquier IP escrita así, sin registrar nada). Si tienes un dominio propio, crea un registro `A` hacia la IP y usa ese nombre.

### 3.5 Conectarse por SSH

En PowerShell de tu PC:

```
icacls $env:USERPROFILE\.ssh\klyvon-key.pem /inheritance:r /grant:r "$($env:USERNAME):R"
ssh -i $env:USERPROFILE\.ssh\klyvon-key.pem ubuntu@3.15.20.7
```

## 4. Preparar el servidor

Todo lo que sigue se ejecuta dentro de la instancia (sesión SSH).

### 4.1 Actualizaciones y parches automáticos

```
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
sudo timedatectl set-timezone UTC
```

### 4.2 Swap de 2 GB

Con 1 GB de RAM, la compilación de las imágenes y los picos de memoria necesitan swap:

```
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
free -h
```

`free -h` debe mostrar `Swap: 2.0Gi`.

### 4.3 Docker y Docker Compose

```
sudo apt -y install docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit
```

Vuelve a conectarte por SSH (para que tome el grupo `docker`) y comprueba:

```
docker version
docker compose version
```

Límite de logs para que no llenen el disco:

```
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

## 5. Traer el código

**Repositorio público**: `git clone https://github.com/TU_USUARIO/klyvon-limpieza.git`.

**Repositorio privado** (recomendado): usa una *deploy key* de solo lectura.

```
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Copia la línea que imprime y pégala en GitHub: **Settings → Deploy keys → Add deploy key** (sin marcar *Allow write access*). Luego:

```
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
git clone git@github.com:TU_USUARIO/klyvon-limpieza.git
cd klyvon-limpieza
```

## 6. Configurar y levantar

### 6.1 Variables de entorno con secretos nuevos

Nunca reutilices los secretos de tu PC. Este bloque crea el `.env` del servidor con valores aleatorios:

```
cp .env.example .env
for clave in POSTGRES_PASSWORD OWNER_PASSWORD APP_PASSWORD JWT_SECRETO FOTOS_FIRMA_SECRETO SEMILLA_CLAVE; do
  sed -i "s/^${clave}=.*/${clave}=$(openssl rand -hex 32)/" .env
done
sed -i "s/^DOMINIO=.*/DOMINIO=3-15-20-7.sslip.io/" .env
sed -i "s/^ENTORNO=.*/ENTORNO=produccion/" .env
chmod 600 .env
grep -c '=$' .env
```

El último comando debe imprimir `0` (ninguna variable vacía). Cambia `3-15-20-7` por tu IP con guiones.

### 6.2 Construir y arrancar

```
docker compose up -d --build --wait
docker compose ps
```

La primera construcción tarda de 5 a 10 minutos en una t3.micro. Al final `ps` debe mostrar `db`, `api` y `web` como `healthy` y `migrate` como `Exited (0)`. Gracias a `restart: unless-stopped`, los contenedores vuelven solos si la instancia se reinicia.

### 6.3 Datos de demostración (opcional, solo para probar)

```
docker compose run --rm migrate python -m scripts.semilla
grep '^SEMILLA_CLAVE=' .env
```

Crea las empresas `ANDINO` y `SUR` con los usuarios `admin`, `supervisor`, `empleado1`, `empleado2` y `empleado3`; la clave de todos es la `SEMILLA_CLAVE`. Para producción real, cambia esas claves desde el panel del administrador o no corras la semilla.

### 6.4 Comprobaciones rápidas

```
curl -s https://3-15-20-7.sslip.io/api/health
curl -sI https://3-15-20-7.sslip.io | grep -iE 'strict-transport|content-security|x-frame'
docker compose logs web --tail 30
docker stats --no-stream
```

Debe responder `{"estado":"ok"}`, mostrar las cabeceras de seguridad y, en los logs de `web`, `certificate obtained successfully`. El consumo esperado es de unos 150 a 250 MB de RAM en total.

## 7. Validar la aplicación

### 7.1 Escritorio (administrador y supervisor)

1. Abre `https://3-15-20-7.sslip.io` en Chrome. El candado debe estar cerrado (certificado válido).
2. Entra con código `ANDINO`, usuario `admin` y la clave. Revisa Empresa, Usuarios, Propiedades y Reportes; exporta un reporte a PDF.
3. Como `supervisor`, asigna una habitación de hoy a `empleado2`.

### 7.2 Celular (vista mobile y PWA)

1. En el teléfono abre la misma dirección. Entra como `empleado2`.
2. **Android (Chrome)**: menú ⋮ → *Instalar app*. **iPhone (Safari, iOS 16.4+)**: botón Compartir → *Añadir a pantalla de inicio*. Abre la app desde el icono: debe verse a pantalla completa, sin barra del navegador.
3. Comprueba que no haya desplazamiento horizontal y que todos los botones se puedan tocar (CP-24).
4. Abre la habitación asignada: la cámara debe abrir en vivo (sin opción de galería, CP-09). La primera foto inicia el cronómetro (CP-07).
5. Haz una pausa y reanuda; toma la foto de salida y finaliza (CP-11, CP-12).

### 7.3 Modo sin conexión (CP-21)

1. Con la app abierta como `empleado2`, inicia una limpieza nueva con red (primera foto).
2. Activa el **modo avión**. Debe aparecer el aviso *Sin conexión a internet. Tus capturas se guardarán en la cola local.*
3. Toma la foto de salida y pulsa *Finalizar limpieza*: queda marcada como *Pendiente de envío*.
4. Cierra y vuelve a abrir la app sin red: debe cargar igual (la sirve el service worker) y mostrar las operaciones pendientes.
5. Desactiva el modo avión. En segundos la cola se sincroniza sola (o con *Sincronizar ahora*).
6. Como supervisor en el escritorio, la limpieza debe aparecer *Enviada* una sola vez, con sus fotos y la duración calculada por el servidor.

En Chrome de escritorio puedes repetirlo con DevTools: **Application → Service Workers** (debe estar *activated*) y la casilla **Network → Offline**. **Lighthouse → Progressive Web App** debe salir instalable.

### 7.4 Seguridad básica desde fuera

```
curl -s -o /dev/null -w "%{http_code}\n" https://3-15-20-7.sslip.io/api/usuarios
curl -s -o /dev/null -w "%{http_code}\n" https://3-15-20-7.sslip.io/api/docs
curl -s -o /dev/null -w "%{http_code}\n" http://3-15-20-7.sslip.io
```

Deben dar `401` (sin token), `404` (documentación oculta en producción) y `308` (redirección a HTTPS). Desde tu PC, `nc -zv 3.15.20.7 5432` debe fallar: la base no está expuesta. Opcional: un escaneo pasivo con OWASP ZAP *Baseline* contra la URL.

## 8. Operación diaria

Actualizar a la última versión de `main`:

```
cd ~/klyvon-limpieza
git pull
docker compose up -d --build --wait
docker image prune -f
```

Las migraciones nuevas se aplican solas: el servicio `migrate` corre antes de la API.

Respaldo diario de la base (cron a las 04:00 UTC, guarda 7 días):

```
mkdir -p ~/respaldos
crontab -e
```

Agrega esta línea:

```
0 4 * * * cd ~/klyvon-limpieza && docker compose exec -T db pg_dump -U postgres -Fc limpieza > ~/respaldos/limpieza-$(date +\%F).dump && find ~/respaldos -name '*.dump' -mtime +7 -delete
```

Restaurar un respaldo:

```
docker compose exec -T db pg_restore -U postgres -d limpieza --clean --if-exists < ~/respaldos/limpieza-AAAA-MM-DD.dump
```

Ver logs y estado: `docker compose logs -f api`, `docker compose ps`. Apagar todo: `docker compose down` (los datos quedan en los volúmenes). Para no gastar horas del Free Tier en pruebas, detén la instancia desde la consola cuando no la uses.

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El navegador dice que el certificado no es válido | Los puertos 80/443 no estaban abiertos cuando arrancó Caddy, o `DOMINIO` no coincide con la IP | Revisa el Security Group y el `.env`; luego `docker compose restart web` |
| La cámara no abre en el celular | Estás entrando por `http://` o por la IP sin dominio | Usa siempre `https://<ip-con-guiones>.sslip.io` |
| Inicias sesión y te devuelve al login | La cookie `Secure` necesita HTTPS | Igual que el anterior |
| La construcción se corta con *Killed* | Falta memoria | Verifica el swap con `free -h` |
| `api` queda `unhealthy` | Error de conexión a la base o secreto vacío | `docker compose logs api migrate` y `grep -c '=$' .env` |
| Demasiadas peticiones (429) al probar | Rate limiting del login (20 por minuto por IP) | Espera un minuto; es una protección esperada |
| SSH ya no conecta | Cambió tu IP pública | Actualiza la regla 22 del Security Group a *My IP* |
