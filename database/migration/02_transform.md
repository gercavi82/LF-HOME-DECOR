# PROCEDIMIENTO DE TRANSFORMACIÓN Y MIGRACIÓN DE DATOS (POSTGRESQL → MYSQL)

**Documento:** `database/migration/02_transform.md`  
**Proyecto:** L&F Home Decor  

---

## 1. Reglas de Transformación de Tipos de Datos

| Tipo en PostgreSQL / Supabase | Tipo Destino en MariaDB / MySQL | Regla de Transformación |
|---|---|---|
| `BOOLEAN` (`true` / `false`) | `TINYINT(1)` (`1` / `0`) | Transformar `true → 1`, `false → 0`. En los scripts de exportación se aplica `CASE WHEN campo THEN 1 ELSE 0 END`. |
| `BIGSERIAL` / `SERIAL` | `BIGINT AUTO_INCREMENT` / `INT AUTO_INCREMENT` | Los IDs se importan respetando la clave primaria existente. Tras la carga se resetea el valor `AUTO_INCREMENT`. |
| `TIMESTAMPTZ` / `TIMESTAMP` | `DATETIME` (UTC) | Formato ISO `YYYY-MM-DD HH:MM:SS`. |
| `NUMERIC(12, 2)` / `NUMERIC(10, 4)` | `DECIMAL(12, 2)` / `DECIMAL(10, 4)` | Preservar precisión numérica decimal idéntica. |
| `TEXT` / `VARCHAR` | `VARCHAR` / `TEXT` (utf8mb4) | Charset `utf8mb4` con collation `utf8mb4_unicode_ci`. |
| `JSONB` / `JSON` | `TEXT` / `JSON` | Serializar como string JSON estándar. |

---

## 2. Estrategia de Migración de Usuarios y Credenciales

### ❌ Lo que NO se migra
1. **`auth.users` de Supabase**: No se migra la tabla interna de GoTrue.
2. **Hashes de contraseña de Supabase**: Los algoritmos internos y salts de Supabase GoTrue no son compatibles directamente con el nuevo backend y contienen dependencias de UUIDs de Supabase.
3. **Tokens y Sesiones**: Las sesiones activas de Supabase quedan invalidadas.

### ✅ Lo que SÍ se migra
1. **Usuarios Funcionales**: Cédula, nombres, apellidos, correo, teléfono, perfil y local asignado.
2. **Mecanismo de Activación / Reset de Contraseña**:
   - Cada usuario migrado se inicializa con una contraseña temporal calculada como `bcrypt.hash(cedula, 12)`.
   - Se establece `debe_cambiar_password = 1`.
   - Se establece `intentos_fallidos = 0` y `bloqueado = 0`.
   - Al iniciar sesión con su cédula, el sistema intercepta el acceso y lo obliga a definir una nueva contraseña personal en `/cambiar-password`.

---

## 3. Guía Paso a Paso de Ejecución

### Paso 1: Exportar desde PostgreSQL (Supabase)
Ejecutar las consultas de [`01_export_postgres.sql`](file:///c:/proyectos/LF-HOME-DECOR-main/LF-HOME-DECOR-main/database/migration/01_export_postgres.sql) en el SQL Editor de Supabase o mediante psql:
```bash
psql -h <SUPABASE_HOST> -U postgres -d postgres -f database/migration/01_export_postgres.sql
```

### Paso 2: Preparar la Base de Datos Destino
En el servidor MySQL / MariaDB (o phpMyAdmin):
1. Asegurarse de haber creado la base de datos `lf_home_decor`.
2. Ejecutar la estructura completa:
   ```bash
   mysql -u root -p lf_home_decor < db/schema.sql
   mysql -u root -p lf_home_decor < db/views.sql
   mysql -u root -p lf_home_decor < db/procedures.sql
   ```

### Paso 3: Importar Datos Transformados
Ejecutar el script [`03_import_mysql.sql`](file:///c:/proyectos/LF-HOME-DECOR-main/LF-HOME-DECOR-main/database/migration/03_import_mysql.sql).

### Paso 4: Validar Conteos e Integridad
Ejecutar las consultas de [`04_verify.sql`](file:///c:/proyectos/LF-HOME-DECOR-main/LF-HOME-DECOR-main/database/migration/04_verify.sql) en ambos motores y comparar los resultados.
