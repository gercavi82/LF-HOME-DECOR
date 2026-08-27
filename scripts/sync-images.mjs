import mysql from "mysql2/promise";
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

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

async function syncImages() {
  console.log("\n🔄 Sincronizando imágenes físicas con la base de datos...");

  const host = process.env.MYSQL_HOST || process.env.DB_HOST || "localhost";
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || "3306");
  const user = process.env.MYSQL_USER || process.env.DB_USER || "root";
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || "lf_home_decor";

  const uploadsDir = resolve(process.cwd(), "public", "uploads", "productos");

  if (!existsSync(uploadsDir)) {
    console.log("ℹ️ No existe la carpeta public/uploads/productos.");
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({ host, port, user, password, database });
  } catch (err) {
    console.error("❌ Error de conexión a la base de datos:", err.message);
    process.exit(1);
  }

  try {
    const folders = readdirSync(uploadsDir);
    let updatedCount = 0;

    for (const folder of folders) {
      const productId = Number(folder);
      if (isNaN(productId)) continue;

      const folderPath = join(uploadsDir, folder);
      if (!statSync(folderPath).isDirectory()) continue;

      const files = readdirSync(folderPath).filter((f) => /\.(jpe?g|png|webp|gif|svg)$/i.test(f));
      if (!files.length) continue;

      // Tomar el archivo de imagen más reciente o primero
      const imageFile = files[0];
      const imageUrl = `/uploads/productos/${productId}/${imageFile}`;

      const [res] = await connection.execute(
        `UPDATE variantes_producto SET imagen_url = ? WHERE id_producto = ?`,
        [imageUrl, productId]
      );

      console.log(`✅ Producto ID ${productId} vinculado con imagen: ${imageUrl}`);
      updatedCount++;
    }

    console.log(`\n🎉 Sincronización finalizada: ${updatedCount} producto(s) actualizados con sus imágenes.\n`);
  } catch (err) {
    console.error("❌ Error durante la sincronización:", err);
  } finally {
    await connection.end();
  }
}

syncImages();
