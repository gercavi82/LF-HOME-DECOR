import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lf_homedecor",
    port: Number(process.env.MYSQL_PORT) || 3306,
  });

  try {
    const [sales] = await pool.query("SELECT * FROM ventas ORDER BY id_venta DESC LIMIT 5");
    console.log("VENTAS RECIENTES:\n", JSON.stringify(sales, null, 2));

    if (sales.length > 0) {
      const lastId = sales[0].id_venta;
      const [items] = await pool.query(`
        SELECT dv.*, vp.precio_venta, vp.costo_unitario as vp_costo, p.descripcion
        FROM detalle_ventas dv
        LEFT JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
        LEFT JOIN productos p ON p.id_producto = vp.id_producto
        WHERE dv.id_venta = ?
      `, [lastId]);
      console.log(`\nDETALLE DE VENTA ${lastId} (${sales[0].numero_venta}):\n`, JSON.stringify(items, null, 2));
    }
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await pool.end();
  }
}

run();
