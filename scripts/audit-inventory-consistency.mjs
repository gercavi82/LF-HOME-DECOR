/**
 * ============================================================================
 * AUDITORÍA INTEGRAL DE CONSISTENCIA DE INVENTARIO — Secciones A-K
 * L&F HOME DECOR / MI HOGAR Y CONFORT
 * ============================================================================
 *
 * Valida:
 *   A. Stocks negativos en stock_producto
 *   B. Duplicados en stock_producto (id_variante, id_bodega)
 *   C. Compras activas sin movimiento COMPRA en Kardex
 *   D. Ventas activas sin movimiento VENTA en Kardex
 *   E. Movimientos huérfanos (variante o bodega inexistente)
 *   F. Tipos de movimiento desconocidos / no estandarizados
 *   G. Movimientos con cantidad <= 0
 *   H. Discontinuidad del Kardex (stock_nuevo[N] ≠ stock_anterior[N+1])
 *   I. Último stock_nuevo vs stock_producto.cantidad
 *   J. SUM(detalle_compras) vs SUM(movimientos COMPRA) por id_compra/variante
 *   K. SUM(detalle_ventas)  vs SUM(movimientos VENTA)  por id_venta/variante
 *
 * Uso:
 *   node scripts/audit-inventory-consistency.mjs
 * ============================================================================
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Carga de entorno ────────────────────────────────────────────────────────
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
            if (!process.env[cleanKey]) process.env[cleanKey] = val;
          }
        }
        break;
      }
    } catch {}
  }
}

loadEnv();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lf_home_decor",
  waitForConnections: true,
  connectionLimit: 3,
  decimalNumbers: true,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOLERANCIA = 0.0001;
const INCOMING_TYPES = new Set([
  "INICIAL", "ENTRADA_INICIAL", "COMPRA", "ENTRADA",
  "DEVOLUCION_CLIENTE", "DEVOLUCION_VENTA", "DEVOLUCION",
  "AJUSTE_ENTRADA", "AJUSTE_SOBRANTE", "CORRECCION_ENTRADA",
  "TRANSFERENCIA_ENTRADA",
]);
const OUTGOING_TYPES = new Set([
  "VENTA", "SALIDA",
  "DEVOLUCION_PROVEEDOR", "DEVOLUCION_COMPRA",
  "AJUSTE_SALIDA", "AJUSTE_FALTANTE", "PERDIDA", "DANO", "DANADO",
  "CORRECCION_SALIDA", "TRANSFERENCIA_SALIDA",
]);
const ALL_KNOWN_TYPES = new Set([...INCOMING_TYPES, ...OUTGOING_TYPES]);

function round4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }

let totalErrors = 0;
let totalWarnings = 0;

function printSection(letra, titulo) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  SECCIÓN ${letra}: ${titulo}`);
  console.log("─".repeat(80));
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); totalWarnings++; }
function error(msg) { console.log(`  ❌ ${msg}`); totalErrors++; }

// ─── SECCIÓN A: Stocks negativos ─────────────────────────────────────────────
async function sectionA(conn) {
  printSection("A", "Stocks negativos en stock_producto");
  const [rows] = await conn.execute(`
    SELECT sp.id_variante, sp.id_bodega, p.descripcion AS producto,
           vp.codigo_gs1, b.nombre AS bodega, sp.cantidad
    FROM stock_producto sp
    JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    JOIN bodegas b ON b.id_bodega = sp.id_bodega
    WHERE sp.cantidad < 0
  `);
  if (rows.length === 0) {
    ok("No existen registros con stock negativo.");
  } else {
    error(`Se detectaron ${rows.length} registros con stock NEGATIVO:`);
    console.table(rows);
  }
  return rows.length;
}

// ─── SECCIÓN B: Duplicados en stock_producto ──────────────────────────────────
async function sectionB(conn) {
  printSection("B", "Duplicados en stock_producto (id_variante, id_bodega)");
  const [rows] = await conn.execute(`
    SELECT id_variante, id_bodega, COUNT(*) AS filas
    FROM stock_producto
    GROUP BY id_variante, id_bodega
    HAVING COUNT(*) > 1
  `);
  if (rows.length === 0) {
    ok("No existen duplicados en stock_producto.");
  } else {
    error(`Se detectaron ${rows.length} combinaciones con filas duplicadas:`);
    console.table(rows);
  }
  return rows.length;
}

// ─── SECCIÓN C: Compras sin movimiento COMPRA ─────────────────────────────────
async function sectionC(conn) {
  printSection("C", "Compras activas sin movimiento COMPRA en Kardex");
  const [rows] = await conn.execute(`
    SELECT 
      c.id_compra,
      c.numero_factura,
      c.fecha,
      dc.id_variante,
      SUM(dc.cantidad) AS cantidad_compra,
      p.descripcion AS producto
    FROM detalle_compras dc
    JOIN compras c ON c.id_compra = dc.id_compra
    JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    LEFT JOIN movimientos_inventario m 
      ON m.referencia_id = c.id_compra 
      AND m.referencia_tipo = 'COMPRA'
      AND m.id_variante = dc.id_variante
      AND m.tipo = 'COMPRA'
    WHERE c.estado != 'ANULADA'
      AND m.id_movimiento IS NULL
    GROUP BY c.id_compra, c.numero_factura, c.fecha, dc.id_variante, p.descripcion
    ORDER BY c.fecha DESC
  `);
  if (rows.length === 0) {
    ok("Todas las compras activas tienen su movimiento COMPRA en el Kardex.");
  } else {
    error(`Se detectaron ${rows.length} compras activas SIN movimiento COMPRA:`);
    console.table(rows.slice(0, 20));
    if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más.`);
  }
  return rows.length;
}

// ─── SECCIÓN D: Ventas sin movimiento VENTA ───────────────────────────────────
async function sectionD(conn) {
  printSection("D", "Ventas activas sin movimiento VENTA en Kardex");
  const [rows] = await conn.execute(`
    SELECT 
      v.id_venta,
      v.numero_factura,
      v.fecha,
      dv.id_variante,
      SUM(dv.cantidad) AS cantidad_venta,
      p.descripcion AS producto
    FROM detalle_ventas dv
    JOIN ventas v ON v.id_venta = dv.id_venta
    JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    LEFT JOIN movimientos_inventario m 
      ON m.referencia_id = v.id_venta 
      AND m.referencia_tipo = 'VENTA'
      AND m.id_variante = dv.id_variante
      AND m.tipo = 'VENTA'
    WHERE v.estado != 'ANULADA'
      AND m.id_movimiento IS NULL
    GROUP BY v.id_venta, v.numero_factura, v.fecha, dv.id_variante, p.descripcion
    ORDER BY v.fecha DESC
  `);
  if (rows.length === 0) {
    ok("Todas las ventas activas tienen su movimiento VENTA en el Kardex.");
  } else {
    error(`Se detectaron ${rows.length} ventas activas SIN movimiento VENTA:`);
    console.table(rows.slice(0, 20));
    if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más.`);
  }
  return rows.length;
}

// ─── SECCIÓN E: Movimientos huérfanos ────────────────────────────────────────
async function sectionE(conn) {
  printSection("E", "Movimientos huérfanos (variante o bodega inexistente)");
  const [rows] = await conn.execute(`
    SELECT 
      m.id_movimiento, m.fecha, m.id_variante, m.id_bodega,
      m.tipo, m.cantidad,
      CASE 
        WHEN vp.id_variante IS NULL THEN 'Variante inexistente'
        WHEN b.id_bodega IS NULL THEN 'Bodega inexistente'
      END AS razon
    FROM movimientos_inventario m
    LEFT JOIN variantes_producto vp ON vp.id_variante = m.id_variante
    LEFT JOIN bodegas b ON b.id_bodega = m.id_bodega
    WHERE vp.id_variante IS NULL OR b.id_bodega IS NULL
  `);
  if (rows.length === 0) {
    ok("No existen movimientos huérfanos.");
  } else {
    error(`Se detectaron ${rows.length} movimientos con variante o bodega inexistente:`);
    console.table(rows);
  }
  return rows.length;
}

// ─── SECCIÓN F: Tipos desconocidos ───────────────────────────────────────────
async function sectionF(conn) {
  printSection("F", "Distribución de tipos de movimiento (detectar tipos desconocidos)");
  const [rows] = await conn.execute(`
    SELECT tipo, COUNT(*) AS total
    FROM movimientos_inventario
    GROUP BY tipo
    ORDER BY total DESC
  `);
  console.table(rows);

  const unknownTypes = rows.filter(r => !ALL_KNOWN_TYPES.has(r.tipo));
  if (unknownTypes.length === 0) {
    ok("Todos los tipos de movimiento son conocidos.");
  } else {
    warn(`Se detectaron ${unknownTypes.length} tipo(s) NO reconocidos en el catálogo:`);
    console.table(unknownTypes);
  }
  return unknownTypes.length;
}

// ─── SECCIÓN G: Cantidades <= 0 ──────────────────────────────────────────────
async function sectionG(conn) {
  printSection("G", "Movimientos con cantidad <= 0");
  const [rows] = await conn.execute(`
    SELECT id_movimiento, id_variante, id_bodega, tipo, cantidad, fecha, motivo
    FROM movimientos_inventario
    WHERE cantidad <= 0
    ORDER BY fecha DESC
  `);
  if (rows.length === 0) {
    ok("No existen movimientos con cantidad <= 0.");
  } else {
    error(`Se detectaron ${rows.length} movimientos con cantidad inválida (<= 0):`);
    console.table(rows);
  }
  return rows.length;
}

// ─── SECCIÓN H: Discontinuidad del Kardex ────────────────────────────────────
async function sectionH(conn) {
  printSection("H", "Discontinuidad del Kardex (stock_nuevo[N] ≠ stock_anterior[N+1])");

  // Cargar todos los movimientos ordenados por variante, bodega, fecha, id_movimiento
  const [rows] = await conn.execute(`
    SELECT id_movimiento, id_variante, id_bodega, tipo,
           cantidad, stock_anterior, stock_nuevo, fecha
    FROM movimientos_inventario
    ORDER BY id_variante ASC, id_bodega ASC, fecha ASC, id_movimiento ASC
  `);

  const discontinuidades = [];
  let prev = null;

  for (const row of rows) {
    const key = `${row.id_variante}:${row.id_bodega}`;
    if (prev && prev.key === key) {
      const diff = round4(Math.abs(Number(row.stock_anterior) - Number(prev.stock_nuevo)));
      if (diff > TOLERANCIA) {
        discontinuidades.push({
          variante: row.id_variante,
          bodega: row.id_bodega,
          mov_anterior: prev.id_movimiento,
          stock_nuevo_anterior: round4(Number(prev.stock_nuevo)),
          mov_actual: row.id_movimiento,
          stock_anterior_actual: round4(Number(row.stock_anterior)),
          diferencia: round4(Number(row.stock_anterior) - Number(prev.stock_nuevo)),
          tipo: row.tipo,
          fecha: row.fecha,
        });
      }
    }
    prev = { key, id_movimiento: row.id_movimiento, stock_nuevo: row.stock_nuevo };
  }

  if (discontinuidades.length === 0) {
    ok("No existen discontinuidades en el Kardex.");
  } else {
    error(`Se detectaron ${discontinuidades.length} discontinuidades en la secuencia del Kardex:`);
    console.table(discontinuidades.slice(0, 20));
    if (discontinuidades.length > 20) console.log(`  ... y ${discontinuidades.length - 20} más.`);
  }
  return discontinuidades.length;
}

// ─── SECCIÓN I: Último stock_nuevo vs stock_producto ─────────────────────────
async function sectionI(conn) {
  printSection("I", "Último stock_nuevo del Kardex vs stock_producto.cantidad");

  // Obtener el último movimiento por variante/bodega
  const [rows] = await conn.execute(`
    SELECT 
      sp.id_variante,
      sp.id_bodega,
      p.descripcion AS producto,
      b.nombre AS bodega,
      sp.cantidad AS stock_tabla,
      m_last.stock_nuevo AS ultimo_stock_nuevo,
      ROUND(sp.cantidad - m_last.stock_nuevo, 4) AS diferencia
    FROM stock_producto sp
    JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    JOIN bodegas b ON b.id_bodega = sp.id_bodega
    LEFT JOIN (
      SELECT id_variante, id_bodega, stock_nuevo
      FROM movimientos_inventario m1
      WHERE id_movimiento = (
        SELECT MAX(m2.id_movimiento)
        FROM movimientos_inventario m2
        WHERE m2.id_variante = m1.id_variante AND m2.id_bodega = m1.id_bodega
          AND m2.fecha = (
            SELECT MAX(m3.fecha)
            FROM movimientos_inventario m3
            WHERE m3.id_variante = m1.id_variante AND m3.id_bodega = m1.id_bodega
          )
      )
    ) m_last ON m_last.id_variante = sp.id_variante AND m_last.id_bodega = sp.id_bodega
    WHERE ABS(sp.cantidad - COALESCE(m_last.stock_nuevo, 0)) > ?
  `, [TOLERANCIA]);

  if (rows.length === 0) {
    ok("El último stock_nuevo del Kardex coincide con stock_producto en todas las variantes.");
  } else {
    error(`Se detectaron ${rows.length} variantes donde el último stock_nuevo del Kardex ≠ stock_producto:`);
    console.table(rows.slice(0, 20));
    if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más.`);
  }
  return rows.length;
}

// ─── SECCIÓN J: Consistencia detalle_compras vs movimientos COMPRA ───────────
async function sectionJ(conn) {
  printSection("J", "Consistencia: SUM(detalle_compras) vs SUM(movimientos COMPRA) por compra/variante");

  const [rows] = await conn.execute(`
    SELECT 
      dc_agg.id_compra,
      c.numero_factura,
      dc_agg.id_variante,
      p.descripcion AS producto,
      dc_agg.cantidad_detalle,
      COALESCE(m_agg.cantidad_kardex, 0) AS cantidad_kardex,
      ROUND(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0), 4) AS diferencia
    FROM (
      SELECT id_compra, id_variante, SUM(cantidad) AS cantidad_detalle
      FROM detalle_compras
      GROUP BY id_compra, id_variante
    ) dc_agg
    JOIN compras c ON c.id_compra = dc_agg.id_compra
    JOIN variantes_producto vp ON vp.id_variante = dc_agg.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    LEFT JOIN (
      SELECT referencia_id, id_variante, SUM(cantidad) AS cantidad_kardex
      FROM movimientos_inventario
      WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA' AND referencia_id IS NOT NULL
      GROUP BY referencia_id, id_variante
    ) m_agg ON m_agg.referencia_id = dc_agg.id_compra AND m_agg.id_variante = dc_agg.id_variante
    WHERE c.estado != 'ANULADA'
      AND ABS(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) > ?
    ORDER BY ABS(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) DESC
  `, [TOLERANCIA]);

  if (rows.length === 0) {
    ok("Las cantidades de detalle_compras coinciden con los movimientos COMPRA del Kardex.");
  } else {
    error(`Se detectaron ${rows.length} discrepancias entre detalle_compras y movimientos COMPRA:`);
    console.table(rows.slice(0, 20));
    if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más.`);
  }
  return rows.length;
}

// ─── SECCIÓN K: Consistencia detalle_ventas vs movimientos VENTA ─────────────
async function sectionK(conn) {
  printSection("K", "Consistencia: SUM(detalle_ventas) vs SUM(movimientos VENTA) por venta/variante");

  const [rows] = await conn.execute(`
    SELECT 
      dv_agg.id_venta,
      v.numero_factura,
      dv_agg.id_variante,
      p.descripcion AS producto,
      dv_agg.cantidad_detalle,
      COALESCE(m_agg.cantidad_kardex, 0) AS cantidad_kardex,
      ROUND(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0), 4) AS diferencia
    FROM (
      SELECT id_venta, id_variante, SUM(cantidad) AS cantidad_detalle
      FROM detalle_ventas
      GROUP BY id_venta, id_variante
    ) dv_agg
    JOIN ventas v ON v.id_venta = dv_agg.id_venta
    JOIN variantes_producto vp ON vp.id_variante = dv_agg.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    LEFT JOIN (
      SELECT referencia_id, id_variante, SUM(cantidad) AS cantidad_kardex
      FROM movimientos_inventario
      WHERE tipo = 'VENTA' AND referencia_tipo = 'VENTA' AND referencia_id IS NOT NULL
      GROUP BY referencia_id, id_variante
    ) m_agg ON m_agg.referencia_id = dv_agg.id_venta AND m_agg.id_variante = dv_agg.id_variante
    WHERE v.estado != 'ANULADA'
      AND ABS(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) > ?
    ORDER BY ABS(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) DESC
  `, [TOLERANCIA]);

  if (rows.length === 0) {
    ok("Las cantidades de detalle_ventas coinciden con los movimientos VENTA del Kardex.");
  } else {
    error(`Se detectaron ${rows.length} discrepancias entre detalle_ventas y movimientos VENTA:`);
    console.table(rows.slice(0, 20));
    if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más.`);
  }
  return rows.length;
}

// ─── SECCIÓN RESUMEN GLOBAL ───────────────────────────────────────────────────
async function sectionResumenGlobal(conn) {
  printSection("∑", "Resumen de consistencia stock_producto vs Kardex acumulado");
  const [rows] = await conn.execute(`
    SELECT 
      COUNT(*) AS total_stocks,
      SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) <= ? THEN 1 ELSE 0 END) AS consistentes,
      SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) > ? THEN 1 ELSE 0 END) AS inconsistentes,
      SUM(CASE WHEN sp.cantidad < 0 THEN 1 ELSE 0 END) AS negativos
    FROM stock_producto sp
    LEFT JOIN (
      SELECT id_variante, id_bodega,
        SUM(CASE 
          WHEN tipo IN ('INICIAL','ENTRADA_INICIAL','COMPRA','ENTRADA','DEVOLUCION_CLIENTE','DEVOLUCION_VENTA','DEVOLUCION',
                        'AJUSTE_ENTRADA','AJUSTE_SOBRANTE','CORRECCION_ENTRADA','TRANSFERENCIA_ENTRADA') THEN cantidad
          WHEN tipo IN ('VENTA','SALIDA','DEVOLUCION_PROVEEDOR','DEVOLUCION_COMPRA','AJUSTE_SALIDA','AJUSTE_FALTANTE',
                        'PERDIDA','DANO','DANADO','CORRECCION_SALIDA','TRANSFERENCIA_SALIDA') THEN -cantidad
          ELSE 0 END
        ) AS saldo_kardex
      FROM movimientos_inventario
      GROUP BY id_variante, id_bodega
    ) k ON k.id_variante = sp.id_variante AND k.id_bodega = sp.id_bodega
  `, [TOLERANCIA, TOLERANCIA]);

  const s = rows[0] || {};
  console.log(`  Total combinaciones variante/bodega: ${s.total_stocks}`);
  console.log(`  ✅ Consistentes (dif ≤ ${TOLERANCIA}):      ${s.consistentes}`);
  console.log(`  ❌ Inconsistentes / Descuadrados:     ${s.inconsistentes}`);
  console.log(`  ❌ Con stock negativo (< 0):          ${s.negativos}`);

  return Number(s.inconsistentes) + Number(s.negativos);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("================================================================================");
  console.log("   AUDITORÍA INTEGRAL DE INVENTARIO (A–K) — L&F HOME DECOR / MI HOGAR         ");
  console.log("================================================================================");
  console.log(`   Fecha: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);

  const conn = await pool.getConnection();
  try {
    await sectionA(conn);
    await sectionB(conn);
    await sectionC(conn);
    await sectionD(conn);
    await sectionE(conn);
    await sectionF(conn);
    await sectionG(conn);
    await sectionH(conn);
    await sectionI(conn);
    await sectionJ(conn);
    await sectionK(conn);
    await sectionResumenGlobal(conn);

    console.log(`\n${"═".repeat(80)}`);
    console.log("  RESULTADO FINAL DE LA AUDITORÍA");
    console.log("═".repeat(80));
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log("  🎉 ¡AUDITORÍA APROBADA! No se detectaron errores ni advertencias.");
    } else {
      if (totalErrors > 0) console.log(`  ❌ Errores críticos detectados: ${totalErrors}`);
      if (totalWarnings > 0) console.log(`  ⚠️  Advertencias detectadas:     ${totalWarnings}`);
      console.log("\n  Próximo paso sugerido:");
      console.log("    node scripts/rebuild-inventory-kardex.mjs --dry-run");
      console.log("    node scripts/rebuild-inventory-kardex.mjs --apply");
    }
    console.log("═".repeat(80) + "\n");

    process.exit(totalErrors > 0 ? 1 : 0);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("\n❌ Error fatal en la auditoría:", err);
  process.exit(1);
});
