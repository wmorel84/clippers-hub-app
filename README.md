# Hub de Clippers de Wilson

Aplicación web completa del hub de campañas para clippers, con sistema real de
cuentas (registro e inicio de sesión con contraseñas cifradas), gestión de
campañas para el administrador, notificaciones, registro de clips y billetera.

## Requisitos

- **Node.js 20 o superior** (recomendado 22+; usa el módulo `node:sqlite` integrado,
  no necesita compilar nada nativo).
- No requiere base de datos externa: usa un archivo SQLite local (`hub.db`).

## Instalación paso a paso

```bash
cd clippers-hub-app
npm install
cp .env.example .env
# Edita .env y pon un SESSION_SECRET largo y aleatorio. Puedes generarlo con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Crear el administrador

```bash
npm run setup-admin
```

Te pedirá nombre, correo y contraseña (mínimo 8 caracteres). La contraseña se
guarda **solo como hash bcrypt** en la base de datos, nunca en texto plano.

## Ejecutar en local

```bash
npm start
```

Abre http://localhost:3000 en tu navegador. Regístrate como clipper con
"Crear cuenta" o entra como administrador con la cuenta creada arriba.

## Cómo desplegar

La app es un servidor Node.js con SQLite. Opciones sencillas:

### Railway / Render / Fly.io
1. Sube este proyecto a un repositorio Git.
2. Crea un nuevo servicio web apuntando al repo (comando de inicio: `npm start`).
3. Define las variables de entorno: `SESSION_SECRET` (largo y aleatorio),
   `PORT` (la plataforma suele inyectarlo sola) y `COOKIE_SECURE=true`.
4. **Importante:** usa un volumen persistente para el archivo `hub.db`; si no,
   la base de datos se borra en cada despliegue. En Railway/Render se configura
   como "disk/volume" montado en la carpeta del proyecto. Alternativa: define
   `DB_PATH` apuntando a la ruta del volumen.

### VPS propio (tu dominio)
1. Apunta tu dominio al servidor y sirve la app detrás de HTTPS (Nginx o Caddy).
2. Ejecuta con un gestor de procesos (`pm2 start server.js` o systemd).
3. Variables de entorno: `SESSION_SECRET`, `PORT`, `COOKIE_SECURE=true`.

## Notas de seguridad

- Cambia `SESSION_SECRET` por un valor largo y aleatorio; nunca uses el de ejemplo.
- Sirve siempre detrás de **HTTPS** en producción (`COOKIE_SECURE=true`).
- Las contraseñas se almacenan con bcrypt (coste 12). Nunca se guardan ni se
  registran en texto plano.
- Todas las consultas SQL son parametrizadas (protección contra inyección SQL).
- Las cookies de sesión son `httpOnly` y `sameSite=lax`.
- Las sesiones viven en memoria del proceso: si reinicias el servidor, los
  usuarios deberán iniciar sesión de nuevo. Para múltiples instancias, usa un
  almacén de sesiones compartido (p. ej. connect-sqlite3).
- Haz copias de seguridad periódicas del archivo `hub.db`.

## Estructura

```
server.js              Servidor Express y configuración de sesiones
db.js                  Esquema SQLite + datos semilla
routes/                API: auth, campaigns, clips, notifications, wallet
middleware/auth.js     requireAuth y requireAdmin
scripts/create-admin.js  Crea el primer admin (npm run setup-admin)
public/                Frontend (index.html, styles.css, app.js)
```

## API (resumen)

- `POST /api/auth/register` `{name, email, password}` → crea cuenta de clipper
- `POST /api/auth/login` `{email, password}` → inicia sesión
- `POST /api/auth/logout` → cierra sesión
- `GET /api/auth/me` → usuario actual (401 si no hay sesión)
- `GET /api/campaigns` → campañas activas (público)
- `POST / PUT / DELETE /api/campaigns` → solo admin
- `GET /api/notifications` · `POST /api/notifications/read-all` → usuario
- `GET / POST /api/clips` → clips del usuario
- `GET /api/wallet` → resumen del usuario
