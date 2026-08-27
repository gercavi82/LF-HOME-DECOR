import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Cargar variables de entorno desde .env.local si existe
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const CEDULA = "1712345678";
const NOMBRES = "Administrador";
const APELLIDOS = "Principal";
const CORREO = "admin@lfhomedecor.com";
const TELEFONO = "0999999999";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? "12");

// Obtener contraseña del argumento CLI o variable de entorno
const cliArg = process.argv.slice(2).find((arg) => arg.startsWith("--password="));
const inputPassword = cliArg ? cliArg.split("=")[1] : process.env.ADMIN_PASSWORD;

if (!inputPassword) {
  console.error("\n❌ Error: No se especificó la contraseña para el administrador.");
  console.log("\nUso:");
  console.log("  node scripts/seed-admin.mjs --password=MiContraseñaSegura123");
  console.log("  ADMIN_PASSWORD=MiContraseñaSegura123 node scripts/seed-admin.mjs\n");
  process.exit(1);
}

if (inputPassword.length < 8) {
  console.error("\n❌ Error: La contraseña debe tener al menos 8 caracteres.\n");
  process.exit(1);
}

async function main() {
  console.log("\n🔐 Configurando Administrador Principal (Cédula: " + CEDULA + ")...");

  const host = process.env.MYSQL_HOST || process.env.DB_HOST || "localhost";
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || "3306");
  const user = process.env.MYSQL_USER || process.env.DB_USER || "root";
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || "lf_home_decor";

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });
  } catch (err) {
    console.error("❌ Error de conexión a la base de datos:", err.message);
    console.log("Verifique las variables en .env.local (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).");
    process.exit(1);
  }

  try {
    // 1. Generar hash bcrypt
    console.log("-> Generando hash bcrypt seguro (" + BCRYPT_ROUNDS + " rondas)...");
    const passwordHash = await bcrypt.hash(inputPassword, BCRYPT_ROUNDS);

    // 2. Asegurar perfil ADMINISTRADOR
    await connection.execute(`
      INSERT INTO perfiles (id_perfil, codigo, nombre, descripcion, activo)
      VALUES (1, 'ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1)
      ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = 1
    `);

    const [perfilRows] = await connection.execute(
      "SELECT id_perfil FROM perfiles WHERE codigo = 'ADMINISTRADOR' OR id_perfil = 1 LIMIT 1"
    );
    const adminProfile = perfilRows[0] || { id_perfil: 1 };

    // 3. Asignar todos los permisos al perfil ADMINISTRADOR
    await connection.execute(
      `INSERT IGNORE INTO perfil_permisos (id_perfil, id_permiso)
       SELECT ?, id_permiso FROM permisos WHERE activo = 1`,
      [adminProfile.id_perfil]
    );

    // 4. Asegurar local matriz
    await connection.execute(`
      INSERT INTO locales (id_local, codigo, nombre, direccion, telefono, activo)
      VALUES (1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
      ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = 1
    `);

    // 5. Limpiar rate limits
    await connection.execute(`DELETE FROM auth_rate_limits`).catch(() => null);

    // 6. Crear o actualizar usuario administrador
    await connection.execute(`
      INSERT INTO usuarios (
        cedula, nombres, apellidos, correo, telefono,
        id_perfil, id_local, password_hash,
        debe_cambiar_password, intentos_fallidos, bloqueado, activo,
        fecha_creacion
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 1, ?,
        0, 0, 0, 1,
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        nombres = VALUES(nombres),
        apellidos = VALUES(apellidos),
        correo = VALUES(correo),
        id_perfil = VALUES(id_perfil),
        password_hash = VALUES(password_hash),
        debe_cambiar_password = 0,
        intentos_fallidos = 0,
        bloqueado = 0,
        activo = 1
    `, [CEDULA, NOMBRES, APELLIDOS, CORREO, TELEFONO, adminProfile.id_perfil, passwordHash]);

    console.log("✅ Administrador principal configurado exitosamente:");
    console.log("   - Cédula: " + CEDULA);
    console.log("   - Contraseña: " + inputPassword);
    console.log("   - Perfil: ADMINISTRADOR");
    console.log("   - Activo: true");
    console.log("   - Bloqueado: false");
    console.log("   - Intentos fallidos: 0");
    console.log("   - Permisos asignados: Todos");
  } catch (err) {
    console.error("❌ Error ejecutando seed de administrador:", err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
