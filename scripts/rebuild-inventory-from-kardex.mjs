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

const isDryRun = !process.argv.includes("--apply");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lf_home_decor",
  waitForConnections: true,
  connectionLimit: 2,
  decimalNumbers: true,
});

async function reconcile() {
  console.log("================================================================================");
  console.log(` RECONCILIACIÓN DE STOCK DESDE EL KARDEX [MODO: ${isDryRun ? "DRY-RUN (SIMULACIÓN)" : "APPLY (EJECUCIÓN REAL)"}] `);
  console.log("================================================================================\n");

  if (isDryRun) {
    console.log("ℹ️  MODO DRY-RUN ACTIVO: No se realizará ninguna modificación en la base de datos.");
    console.log("   Para aplicar los cambios reales, ejecuta el comando con el argumento: --apply\n");
  }

  const conn = await pool.getConnection();
  try {
    // 1. Obtener todas las inconsistencias actuales
    const [discrepancies] = await conn.execute(`
      SELECT 
        sp.id_stock,
        sp.id_variante,
        sp.id_bodega,
        p.descripcion AS producto,
        vp.codigo_gs1,
        b.nombre AS bodega,
        ROUND(sp.cantidad, 4) AS stock_actual,
        ROUND(COALESCE(k.saldo_kardex, 0), 4) AS stock_kardex,
        ROUND(COALESCE(k.saldo_kardex, 0) - sp.cantidad, 4) AS diferencia
      FROM stock_producto sp
      JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
      JOIN productos p ON p.id_producto = vp.id_producto
      JOIN bodegas b ON b.id_bodega = sp.id_bodega
      LEFT JOIN (
        SELECT 
          id_variante,
          id_bodega,
          SUM(
            CASE 
              WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL', 'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN cantidad
              WHEN tipo IN ('VENTA', 'DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN -cantidad
              ELSE 0
            END
          ) AS saldo_kardex
        FROM movimientos_inventario
        GROUP BY id_variante, id_bodega
      ) k ON k.id_variante = sp.id_variante AND k.id_bodega = sp.id_bodega
      WHERE ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) > 0.0001
      ORDER BY ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) DESC
    `);

    if (discrepancies.length === 0) {
      console.log("✅ No se detectaron inconsistencias entre stock_producto y el Kardex. ¡Todo está perfectamente cuadrado!");
      return;
    }

    console.log(`Se encontraron ${discrepancies.length} registros que requieren conciliación:\n`);
    console.table(discrepancies.map(d => ({
      ID: d.id_stock,
      Producto: d.producto.slice(0, 35),
      Bodega: d.bodega,
      "Stock Tabla": d.stock_actual,
      "Stock Kardex (Correcto)": d.stock_kardex,
      Diferencia: d.diferencia
    })));

    if (!isDryRun) {
      console.log("\nIniciando transacción de actualización...");
      await conn.beginTransaction();
      try {
        let updatedCount = 0;
        for (const row of discrepancies) {
          await conn.execute(
            `UPDATE stock_producto 
             SET cantidad = ?, fecha_actualizacion = NOW() 
             WHERE id_stock = ?`,
            [row.stock_kardex, row.id_stock]
          );
          updatedCount++;
        }
        await conn.commit();
        console.log(`\n🎉 ÉXITO: Se actualizaron y cuadraron ${updatedCount} registros en stock_producto.`);
      } catch (err) {
        await conn.rollback();
        console.error("❌ ERROR durante la conciliación. Se aplicó ROLLBACK completo:", err);
        throw err;
      }
    } else {
      console.log(`\nSimulación completada. ${discrepancies.length} registros habrían sido actualizados.`);
    }

  } finally {
    conn.release();
    await pool.end();
  }
}

reconcile().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
