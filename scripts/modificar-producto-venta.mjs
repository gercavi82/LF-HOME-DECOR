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

async function run() {
  const targetNumeroVenta = "V-20260908232925-483CCF";
  const oldProductNamePart = "Cobertor Plus Ovejero 2 Plazas";
  const newProductNamePart = "Cobertor Plus Ovejero 2 1/2 Plazas";

  console.log("==================================================");
  console.log(`Modificando producto en venta: ${targetNumeroVenta}`);
  console.log(`De:  ${oldProductNamePart} (Full)`);
  console.log(`A:   ${newProductNamePart} (Queen)`);
  console.log("==================================================");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || "localhost",
    user: process.env.DB_USER || process.env.MYSQL_USER || "root",
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "lf_homedecor",
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
  });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Buscar la venta
    const [saleRows] = await conn.execute(
      "SELECT id_venta, numero_venta, total, subtotal, fecha FROM ventas WHERE numero_venta = ?",
      [targetNumeroVenta]
    );

    if (!Array.isArray(saleRows) || saleRows.length === 0) {
      throw new Error(`No se encontró la venta con número: ${targetNumeroVenta}`);
    }

    const sale = saleRows[0];
    const idVenta = sale.id_venta;
    console.log(`✓ Venta encontrada: ID ${idVenta}, Total: $${sale.total}, Fecha: ${sale.fecha}`);

    // 2. Buscar el item en detalle_ventas
    const [detailRows] = await conn.execute(
      `SELECT dv.id_detalle, dv.id_variante, dv.cantidad, dv.precio_unitario, dv.total, p.descripcion
       FROM detalle_ventas dv
       JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
       JOIN productos p ON p.id_producto = vp.id_producto
       WHERE dv.id_venta = ? AND (p.descripcion LIKE ? OR p.descripcion LIKE '%Ovejero 2 Plazas%')`,
      [idVenta, `%${oldProductNamePart}%`]
    );

    if (!Array.isArray(detailRows) || detailRows.length === 0) {
      // Mostrar los items actuales para depurar
      const [allItems] = await conn.execute(
        `SELECT dv.id_detalle, dv.id_variante, p.descripcion
         FROM detalle_ventas dv
         JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
         JOIN productos p ON p.id_producto = vp.id_producto
         WHERE dv.id_venta = ?`,
        [idVenta]
      );
      console.log("Items actuales en la venta:", allItems);
      throw new Error("No se encontró el item a reemplazar en esta venta.");
    }

    const detailItem = detailRows[0];
    const oldIdVariante = detailItem.id_variante;
    const cantidadItem = Number(detailItem.cantidad);
    console.log(`✓ Item actual a cambiar: ID Detalle ${detailItem.id_detalle}, Variante: ${oldIdVariante}, Producto: "${detailItem.descripcion}", Cantidad: ${cantidadItem}`);

    // 3. Buscar la variante destino (Cobertor Plus Ovejero 2 1/2 Plazas Queen)
    const [newVariantRows] = await conn.execute(
      `SELECT vp.id_variante, vp.costo_unitario, p.id_producto, p.descripcion, p.precio_venta
       FROM variantes_producto vp
       JOIN productos p ON p.id_producto = vp.id_producto
       WHERE p.descripcion LIKE ? OR p.descripcion LIKE '%Ovejero 2 1/2 Plazas%' OR p.descripcion LIKE '%Ovejero%Queen%'
       LIMIT 1`,
      [`%${newProductNamePart}%`]
    );

    if (!Array.isArray(newVariantRows) || newVariantRows.length === 0) {
      throw new Error(`No se encontró en catálogo el producto destino: ${newProductNamePart}`);
    }

    const newVariant = newVariantRows[0];
    const newIdVariante = newVariant.id_variante;
    const newCostoUnitario = Number(newVariant.costo_unitario || 0);
    const newCostoTotal = Number((newCostoUnitario * cantidadItem).toFixed(2));
    const newUtilidad = Math.max(0, Number((Number(detailItem.total) - newCostoTotal).toFixed(2)));

    console.log(`✓ Nueva variante encontrada: ID ${newIdVariante}, Producto: "${newVariant.descripcion}", Costo Unitario: $${newCostoUnitario}`);

    // 4. Actualizar detalle_ventas
    await conn.execute(
      `UPDATE detalle_ventas 
       SET id_variante = ?, 
           costo_unitario = ?, 
           costo_total = ?, 
           utilidad = ? 
       WHERE id_detalle = ?`,
      [newIdVariante, newCostoUnitario, newCostoTotal, newUtilidad, detailItem.id_detalle]
    );
    console.log(`✓ detalle_ventas actualizado para id_detalle ${detailItem.id_detalle}`);

    // 5. Ajustar inventario (devolver stock de variante anterior y descontar de la nueva)
    // 5a. Regresar stock a la variante anterior
    await conn.execute(
      `UPDATE stock_producto 
       SET cantidad = cantidad + ?, fecha_actualizacion = NOW() 
       WHERE id_variante = ?`,
      [cantidadItem, oldIdVariante]
    );

    // 5b. Descontar stock de la nueva variante
    await conn.execute(
      `UPDATE stock_producto 
       SET cantidad = cantidad - ?, fecha_actualizacion = NOW() 
       WHERE id_variante = ?`,
      [cantidadItem, newIdVariante]
    );
    console.log(`✓ Stock actualizado: +${cantidadItem} para variante ${oldIdVariante}, -${cantidadItem} para variante ${newIdVariante}`);

    // 5c. Actualizar referencia en movimientos_inventario si existe
    await conn.execute(
      `UPDATE movimientos_inventario 
       SET id_variante = ? 
       WHERE referencia_tipo = 'VENTA' AND referencia_id = ? AND id_variante = ?`,
      [newIdVariante, idVenta, oldIdVariante]
    );

    // 6. Recalcular costos, utilidad y comisiones de la venta
    const [recalcRows] = await conn.execute(
      `SELECT 
         COALESCE(SUM(dv.costo_total), 0) AS total_costo,
         GREATEST(0, v.total - COALESCE(SUM(dv.costo_total), 0)) AS total_utilidad
       FROM ventas v
       LEFT JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
       WHERE v.id_venta = ?
       GROUP BY v.id_venta`,
      [idVenta]
    );

    if (Array.isArray(recalcRows) && recalcRows.length > 0) {
      const recalc = recalcRows[0];
      const costoTotal = Number(recalc.total_costo);
      const utilidad = Number(recalc.total_utilidad);
      const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number((utilidad * 0.40).toFixed(2));

      await conn.execute(
        `UPDATE ventas 
         SET costo_total = ?, utilidad = ?, comision_asesor = ?, comision_local = ? 
         WHERE id_venta = ?`,
        [costoTotal, utilidad, comisionAsesor, comisionLocal, idVenta]
      );
      console.log(`✓ Venta recalculada: Costo: $${costoTotal}, Utilidad: $${utilidad}, Com. Asesor: $${comisionAsesor}, Com. Local: $${comisionLocal}`);
    }

    await conn.commit();
    console.log("\n==================================================");
    console.log("¡MODIFICACIÓN REALIZADA CON ÉXITO Y DE FORMA SEGURA!");
    console.log("==================================================");
  } catch (error) {
    await conn.rollback();
    console.error("\n❌ ERROR DURANTE LA OPERACIÓN (ROLLBACK APLICADO):", error.message);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
