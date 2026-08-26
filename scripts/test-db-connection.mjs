import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envFiles = [".env.production", ".env.local", ".env"];
  for (const file of envFiles) {
    try {
      const fullPath = resolve(process.cwd(), file);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const [key, ...rest] = trimmed.split("=");
          if (key && rest.length > 0) {
            const cleanKey = key.trim();
            const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
            if (!process.env[cleanKey]) {
              process.env[cleanKey] = val;
            }
          }
        }
      }
    } catch {}
  }
}

loadEnv();

const host = process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT || "3306");
const user = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "";
const database = process.env.DB_NAME || "lf_home_decor";

console.log("--------------------------------------------------");
console.log("Probando conexión a MySQL con los parámetros:");
console.log(`Host:     ${host}:${port}`);
console.log(`Usuario:  ${user}`);
console.log(`Base:     ${database}`);
console.log(`Password: ${password ? "******** (configurado)" : "(vacío)"}`);
console.log("--------------------------------------------------");

async function test() {
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 5000,
    });

    console.log("✅ Conexión exitosa a MySQL!");

    const [tables] = await connection.execute("SHOW TABLES");
    console.log(`✅ Tablas encontradas en '${database}': ${tables.length}`);

    const [users] = await connection.execute(
      "SELECT id_usuario, cedula, nombres, apellidos, activo, bloqueado, debe_cambiar_password FROM usuarios LIMIT 5"
    );
    console.log(`✅ Usuarios en tabla 'usuarios':`, users);

    await connection.end();
  } catch (err) {
    console.error("❌ ERROR al conectar con MySQL:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error("   -> El servidor MySQL no está corriendo o el puerto/host es incorrecto (intente 127.0.0.1 en lugar de localhost).");
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   -> Usuario o contraseña de MySQL incorrectos.");
    } else if (err.code === "ER_BAD_DB_ERROR") {
      console.error(`   -> La base de datos '${database}' no existe.`);
    }
  }
}

test();
