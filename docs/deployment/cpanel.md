# GUÍA DE DESPLIEGUE EN PRODUCCIÓN (cPanel / CloudLinux / Phusion Passenger)

**Dominio:** `https://mihogaryconfort.com`  
**Aplicación:** Next.js 16 + MySQL/MariaDB + Autenticación Propia (Bcrypt + HttpOnly)

---

## 1. Requisitos del Servidor cPanel

- **Node.js**: Versión 20.x LTS o superior (mediante "Setup Node.js App" / "Application Manager").
- **Motor de Base de Datos**: MariaDB 10.7+ o MySQL 8.0+.
- **Herramienta Administrativa**: phpMyAdmin (incluido en cPanel).
- **Certificado SSL**: Activo (Let's Encrypt / AutoSSL) para `https://mihogaryconfort.com`.

---

## 2. Paso 1: Configurar la Base de Datos en cPanel

1. Ingrese a **cPanel → Bases de datos MySQL**.
2. Crear una nueva base de datos (ejemplo: `cpaneluser_lfhomedecor`).
3. Crear un usuario de base de datos con contraseña robusta (ejemplo: `cpaneluser_dbuser`).
4. Asignar el usuario a la base de datos con **TODOS LOS PRIVILEGIOS** (`ALL PRIVILEGES`).
5. Abrir **phpMyAdmin**:
   - Seleccionar la base de datos creada.
   - Ir a la pestaña **Importar**.
   - Cargar y ejecutar el archivo: [`db/full_database_setup.sql`](file:///c:/proyectos/LF-HOME-DECOR-main/LF-HOME-DECOR-main/db/full_database_setup.sql).

---

## 3. Paso 2: Crear la Aplicación en "Setup Node.js App"

1. Ingrese a **cPanel → Setup Node.js App** (o Application Manager).
2. Clic en **Create Application**:
   - **Node.js version**: 20.x o superior.
   - **Application mode**: `Production`.
   - **Application root**: `lfhomedecor` (directorio del proyecto en su `/home/usuario/`).
   - **Application URL**: `mihogaryconfort.com` (o subdominio asignado).
   - **Application startup file**: `server.js` (o ejecutar mediante Next.js custom server / standalone).
3. Clic en **Create**.

---

## 4. Paso 3: Configurar Variables de Entorno en cPanel

Dentro de la sección **Environment variables** en "Setup Node.js App", agregar las siguientes variables:

| Variable | Valor de Producción | Descripción |
|---|---|---|
| `NODE_ENV` | `production` | Modo de ejecución optimizado. |
| `DB_HOST` | `localhost` | Host MySQL de cPanel (usualmente `localhost` o `127.0.0.1`). |
| `DB_PORT` | `3306` | Puerto estándar MySQL. |
| `DB_NAME` | `cpaneluser_lfhomedecor` | Nombre completo de la base creada en cPanel. |
| `DB_USER` | `cpaneluser_dbuser` | Usuario MySQL de cPanel. |
| `DB_PASSWORD` | `[SuContraseñaSegura]` | Contraseña del usuario MySQL. |
| `SESSION_COOKIE_NAME` | `lf_session` | Nombre de la cookie de sesión HttpOnly. |
| `SESSION_MAX_AGE` | `604800` | Tiempo de vida de sesión en segundos (7 días). |
| `SESSION_SECRET` | `[StringAleatorioSeguro32Chars]` | Llave para firma y rate limiting. |
| `BCRYPT_ROUNDS` | `12` | Complejidad de hashing para contraseñas. |
| `APP_URL` | `https://mihogaryconfort.com` | URL base canónica del sistema. |

> [!CAUTION]
> **NUNCA** subir archivos `.env.production` ni `.env.local` con credenciales reales a GitHub ni a repositorios públicos. El archivo `.gitignore` ya está configurado para proteger estos secretos.

---

## 5. Paso 4: Inicializar Contraseña del Administrador Principal

Para configurar la contraseña inicial del administrador principal (`cedula: 1712345678`) de forma segura en el servidor:

```bash
# Vía terminal SSH de cPanel:
cd ~/lfhomedecor
npm run seed:admin -- --password=SuContrasenaSegura2026!
```

---

## 6. Paso 5: Permisos de Archivos y Carga de Imágenes

Asegurarse de que el directorio de almacenamiento local de imágenes tenga permisos de escritura:
```bash
chmod -R 755 public/uploads
```

---

## 7. Paso 6: Compilación e Inicio de la Aplicación

1. En la consola SSH o mediante el botón **Run NPM Install** en cPanel:
   ```bash
   npm install --production=false
   npm run build
   ```
2. Reiniciar la aplicación desde el panel de cPanel (**Restart Application**).
3. Acceder a `https://mihogaryconfort.com/login` e iniciar sesión.
