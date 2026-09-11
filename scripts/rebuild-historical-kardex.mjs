/**
 * ==============================================================================
 * RECONSTRUCCIÓN DEL KARDEX HISTÓRICO COMPLETO
 * L&F HOME DECOR / MI HOGAR Y CONFORT
 * ==============================================================================
 *
 * Modos de uso:
 *   node scripts/rebuild-historical-kardex.mjs           (modo --dry-run por defecto)
 *   node scripts/rebuild-historical-kardex.mjs --dry-run (modo simulación)
 *   node scripts/rebuild-historical-kardex.mjs --apply   (aplica cambios reales en BD)
 *
 * REGLAS FUNDAMENTALES Y PROHIBICIONES:
 *   ✅ NO modificar stock_producto.cantidad (es la verdad física final).
 *   ✅ NO eliminar movimientos_inventario existentes (sin DELETE ni TRUNCATE).
 *   ✅ NO duplicar ventas ni AJUSTE_FISICO existentes.
 *   ✅ Conservar los movimientos AJUSTE_FISICO del 2026-09-10 intactos.
 *   ✅ Idempotente: correr 2 veces produce 0 inserts, 0 updates y ESTADO = OK.
 *   ✅ Transacción con ROLLBACK por variante/bodega si el saldo final no cuadra.
 *   ✅ Backup automático con timestamp nuevo antes de --apply.
 * ==============================================================================
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

// ─── 1. Carga de Variables de Entorno ─────────────────────────────────────────

function loadEnv() {
  for (const file of [".env.production", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (!existsSync(fullPath)) continue;
    try {
      const content = readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const cleanKey = key?.trim();
        if (cleanKey && rest.length > 0 && !process.env[cleanKey]) {
          process.env[cleanKey] = rest.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    } catch {}
    break;
  }
}

loadEnv();

// ─── 2. Configuración y Parámetros ────────────────────────────────────────────

const IS_APPLY = process.argv.includes("--apply");
const IS_DRY_RUN = !IS_APPLY;
const TOLERANCIA = 0.0001;

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lf_home_decor",
  waitForConnections: true,
  connectionLimit: 3,
  decimalNumbers: true,
  multipleStatements: false,
};

// ─── 3. Catálogo Canónico de Tipos y Factores ─────────────────────────────────

const ENTRADAS_TYPES = new Set([
  "INICIAL",
  "ENTRADA_INICIAL",
  "COMPRA",
  "ENTRADA",
  "DEVOLUCION_CLIENTE",
  "DEVOLUCION_VENTA",
  "DEVOLUCION",
  "AJUSTE_ENTRADA",
  "AJUSTE_SOBRANTE",
  "CORRECCION_ENTRADA",
  "TRANSFERENCIA_ENTRADA",
]);

const SALIDAS_TYPES = new Set([
  "VENTA",
  "SALIDA",
  "DEVOLUCION_PROVEEDOR",
  "DEVOLUCION_COMPRA",
  "AJUSTE_SALIDA",
  "AJUSTE_FALTANTE",
  "PERDIDA",
  "DANO",
  "DANADO",
  "CORRECCION_SALIDA",
  "TRANSFERENCIA_SALIDA",
]);

function getFactor(tipo) {
  if (ENTRADAS_TYPES.has(tipo)) return 1;
  if (SALIDAS_TYPES.has(tipo)) return -1;
  return 0;
}

function r4(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function nowTs() {
  const d = new Date();
  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) =>
    rl.question(question, (ans) => {
      rl.close();
      res(ans.trim().toLowerCase());
    })
  );
}

// ─── 4. FASE 0: Backup con Timestamp Nuevo (Requisito 12) ────────────────────

async function createBackup(pool, ts) {
  const backupName = `movimientos_inventario_backup_rebuild_${ts}`;
  const backupStock = `stock_producto_backup_rebuild_${ts}`;

  console.log(`\n📦 FASE 0 — Creando backup obligatorio antes de --apply...`);
  const conn = await pool.getConnection();
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`${backupName}\` LIKE \`movimientos_inventario\``);
    await conn.execute(`INSERT IGNORE INTO \`${backupName}\` SELECT * FROM \`movimientos_inventario\``);
    const [[{ n: nMov }]] = await conn.execute(`SELECT COUNT(*) AS n FROM \`${backupName}\``);
    console.log(`  ✅ ${backupName} respaldada (${nMov} filas)`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS \`${backupStock}\` LIKE \`stock_producto\``);
    await conn.execute(`INSERT IGNORE INTO \`${backupStock}\` SELECT * FROM \`stock_producto\``);
    const [[{ n: nStk }]] = await conn.execute(`SELECT COUNT(*) AS n FROM \`${backupStock}\``);
    console.log(`  ✅ ${backupStock} respaldada (${nStk} filas)\n`);
  } catch (err) {
    console.error(`  ❌ Error creando backup:`, err.message);
    throw new Error(`Backup fallido. Operación cancelada por seguridad: ${err.message}`);
  } finally {
    conn.release();
  }
}

// ─── 5. FASE 1: Carga de Datos Base desde Fuentes Reales ─────────────────────

async function loadSources(pool) {
  const conn = await pool.getConnection();
  try {
    // A. stock_producto (saldos físicos finales objetivos)
    const [stocks] = await conn.execute(`
      SELECT sp.id_variante, sp.id_bodega, sp.id_stock, sp.cantidad AS stock_fisico_final,
             p.descripcion AS producto, vp.codigo_gs1, vp.codigo_interno,
             b.nombre AS bodega, b.id_local
      FROM stock_producto sp
      JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
      JOIN productos p ON p.id_producto = vp.id_producto
      JOIN bodegas b ON b.id_bodega = sp.id_bodega
      ORDER BY sp.id_variante, sp.id_bodega
    `);

    // B. Compras activas agrupadas por id_compra e id_variante desde detalle_compras
    const [compras] = await conn.execute(`
      SELECT c.id_compra, c.numero_compra, c.fecha AS fecha_compra,
             c.id_local AS local_compra,
             dc.id_variante,
             SUM(dc.cantidad) AS cantidad_detalle
      FROM detalle_compras dc
      JOIN compras c ON c.id_compra = dc.id_compra
      WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
      GROUP BY c.id_compra, c.numero_compra, c.fecha, c.id_local, dc.id_variante
      ORDER BY c.fecha ASC, c.id_compra ASC
    `);

    // C. Bodegas activas por local
    const [bodegas] = await conn.execute(`
      SELECT id_bodega, id_local, nombre FROM bodegas
      WHERE activo = 1
      ORDER BY id_local, id_bodega ASC
    `);

    // D. Todos los movimientos existentes en movimientos_inventario
    const [movs] = await conn.execute(`
      SELECT id_movimiento, id_variante, id_bodega, tipo, cantidad,
             stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, referencia_id
      FROM movimientos_inventario
      ORDER BY id_variante, id_bodega, fecha ASC, id_movimiento ASC
    `);

    return { stocks, compras, bodegas, movs };
  } finally {
    conn.release();
  }
}

// ─── 6. FASE 2: Análisis y Cálculo Residual de Inventario Inicial ────────────

function analyzeHistoricalData({ stocks, compras, bodegas, movs }) {
  // Indexar movimientos por variante:bodega
  const movMap = new Map();
  for (const m of movs) {
    const k = `${m.id_variante}:${m.id_bodega}`;
    if (!movMap.has(k)) movMap.set(k, []);
    movMap.get(k).push(m);
  }

  // Indexar bodegas activas por local
  const bodegasByLocal = new Map();
  for (const b of bodegas) {
    const locId = Number(b.id_local);
    if (!bodegasByLocal.has(locId)) bodegasByLocal.set(locId, []);
    bodegasByLocal.get(locId).push(Number(b.id_bodega));
  }

  // Indexar movimientos COMPRA ya existentes en Kardex: key = id_compra:id_variante:id_bodega -> SUM(cantidad)
  const compraKardexMap = new Map();
  for (const m of movs) {
    if (m.tipo === "COMPRA" && m.referencia_tipo === "COMPRA" && m.referencia_id) {
      const k = `${m.referencia_id}:${m.id_variante}:${m.id_bodega}`;
      compraKardexMap.set(k, r4((compraKardexMap.get(k) || 0) + Number(m.cantidad)));
    }
  }

  const results = [];

  for (const stk of stocks) {
    const idV = Number(stk.id_variante);
    const idB = Number(stk.id_bodega);
    const idL = Number(stk.id_local);
    const stockFisico = r4(stk.stock_fisico_final);
    const key = `${idV}:${idB}`;

    const movsVB = movMap.get(key) || [];

    // 1. Acumuladores de movimientos históricos existentes
    let totalVentas = 0;
    let otrasEntradas = 0;
    let otrasSalidas = 0;
    let tieneInicial = false;
    let cantidadInicialExistente = 0;

    for (const m of movsVB) {
      const tipo = m.tipo;
      const cant = r4(m.cantidad);

      if (tipo === "INICIAL" || tipo === "ENTRADA_INICIAL") {
        tieneInicial = true;
        cantidadInicialExistente = r4(cantidadInicialExistente + cant);
        continue;
      }
      if (tipo === "COMPRA") {
        // Las compras se computarán desde la fuente oficial detalle_compras
        continue;
      }
      if (tipo === "VENTA") {
        totalVentas = r4(totalVentas + cant);
        continue;
      }

      const factor = getFactor(tipo);
      if (factor > 0) otrasEntradas = r4(otrasEntradas + cant);
      if (factor < 0) otrasSalidas = r4(otrasSalidas + cant);
    }

    // 2. Compras válidas para esta variante y bodega desde detalle_compras
    const comprasVariante = compras.filter((c) => Number(c.id_variante) === idV);
    let totalCompras = 0;
    const comprasFaltantes = [];

    for (const c of comprasVariante) {
      const locCompra = Number(c.local_compra);
      const bBodegas = bodegasByLocal.get(locCompra) || [];

      // Asignar a la bodega activa correspondiente al local de la compra
      if (!bBodegas.includes(idB)) continue;

      const cantDetalle = r4(c.cantidad_detalle);
      totalCompras = r4(totalCompras + cantDetalle);

      const kCompra = `${c.id_compra}:${idV}:${idB}`;
      const cantEnKardex = compraKardexMap.get(kCompra) || 0;
      const diffCompra = r4(cantDetalle - cantEnKardex);

      if (diffCompra > TOLERANCIA) {
        comprasFaltantes.push({
          id_compra: c.id_compra,
          numero_compra: c.numero_compra,
          fecha_compra: c.fecha_compra,
          id_variante: idV,
          id_bodega: idB,
          cantDetalle,
          cantEnKardex,
          diferencia: diffCompra,
        });
      }
    }

    // 3. Fórmula fundamental de Inventario Inicial Residual:
    // INICIAL = stock_fisico_final - TOTAL_COMPRAS + TOTAL_VENTAS - TOTAL_OTRAS_ENTRADAS + TOTAL_OTRAS_SALIDAS
    const inicialCalculado = r4(stockFisico - totalCompras + totalVentas - otrasEntradas + otrasSalidas);

    // 4. Determinar estado
    let estado = "OK";
    if (inicialCalculado < -TOLERANCIA) {
      estado = "REQUIERE_REVISION";
    } else if (!tieneInicial && inicialCalculado > TOLERANCIA && comprasFaltantes.length > 0) {
      estado = "REQUIERE_INICIAL";
    } else if (!tieneInicial && inicialCalculado > TOLERANCIA) {
      estado = "REQUIERE_INICIAL";
    } else if (comprasFaltantes.length > 0) {
      estado = "REQUIERE_COMPRAS";
    }

    // 5. Simular saldo reconstruido
    const saldoReconstruido = r4(
      (tieneInicial ? cantidadInicialExistente : inicialCalculado > TOLERANCIA ? inicialCalculado : 0)
      + totalCompras
      + otrasEntradas
      - totalVentas
      - otrasSalidas
    );
    const diferencia = r4(stockFisico - saldoReconstruido);

    if (estado === "OK" && Math.abs(diferencia) > TOLERANCIA) {
      estado = "DIFERENCIA_FINAL";
    }

    // Primera fecha histórica de eventos para colocar el INICIAL 1 segundo antes
    const fechas = [
      ...movsVB.map((m) => new Date(m.fecha).getTime()),
      ...comprasVariante.map((c) => new Date(c.fecha_compra).getTime()),
    ].filter((t) => !isNaN(t));
    const primerEventoFecha = fechas.length > 0 ? new Date(Math.min(...fechas)) : new Date("2020-01-01T00:00:00");

    results.push({
      id_variante: idV,
      id_bodega: idB,
      producto: stk.producto,
      bodega: stk.bodega,
      stock_fisico_final: stockFisico,
      inventario_inicial_calculado: inicialCalculado,
      tieneInicial,
      cantidadInicialExistente,
      total_compras: totalCompras,
      total_ventas: totalVentas,
      otras_entradas: otrasEntradas,
      otras_salidas: otrasSalidas,
      compras_faltantes_total: comprasFaltantes.reduce((acc, c) => r4(acc + c.diferencia), 0),
      comprasFaltantes,
      saldo_reconstruido: saldoReconstruido,
      diferencia,
      estado,
      primerEventoFecha,
    });
  }

  return results;
}

// ─── 7. FASE 3: Reconstrucción Transaccional por Variante/Bodega ──────────────

async function reconstructVariant(conn, item, isDryRun) {
  const {
    id_variante,
    id_bodega,
    producto,
    stock_fisico_final,
    inventario_inicial_calculado,
    tieneInicial,
    comprasFaltantes,
    primerEventoFecha,
  } = item;

  const logs = [];

  // A. Insertar o actualizar INICIAL si corresponde
  if (!tieneInicial && inventario_inicial_calculado > TOLERANCIA) {
    const fechaInicial = new Date(primerEventoFecha.getTime() - 1000);
    const fechaStr = fechaInicial.toISOString().slice(0, 19).replace("T", " ");

    if (!isDryRun) {
      // Idempotencia preventiva
      const [[{ cnt }]] = await conn.execute(`
        SELECT COUNT(*) AS cnt FROM movimientos_inventario
        WHERE id_variante = ? AND id_bodega = ?
          AND tipo IN ('INICIAL', 'ENTRADA_INICIAL')
      `, [id_variante, id_bodega]);

      if (Number(cnt) === 0) {
        await conn.execute(`
          INSERT INTO movimientos_inventario
            (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
             motivo, referencia_tipo, referencia_id, usuario, fecha)
          VALUES (?, ?, 'INICIAL', ?, 0, ?,
                  'Reconstrucción histórica de inventario inicial',
                  'RECONSTRUCCION_INICIAL', NULL, 'SISTEMA', ?)
        `, [id_variante, id_bodega, r4(inventario_inicial_calculado), r4(inventario_inicial_calculado), fechaStr]);
      }
    }
    logs.push(`+ INICIAL: ${r4(inventario_inicial_calculado)} (fecha: ${fechaStr})`);
  } else if (tieneInicial && inventario_inicial_calculado > TOLERANCIA) {
    // Si ya existe un INICIAL de reconstrucción previa, actualizar si varió al integrar las compras
    if (!isDryRun) {
      await conn.execute(`
        UPDATE movimientos_inventario
        SET cantidad = ?
        WHERE id_variante = ? AND id_bodega = ?
          AND tipo IN ('INICIAL', 'ENTRADA_INICIAL')
          AND referencia_tipo = 'RECONSTRUCCION_INICIAL'
      `, [r4(inventario_inicial_calculado), id_variante, id_bodega]);
    }
    logs.push(`⟳ INICIAL verificado/actualizado: ${r4(inventario_inicial_calculado)}`);
  }

  // B. Insertar COMPRAs faltantes
  for (const c of comprasFaltantes) {
    const cantInsertar = r4(c.diferencia);
    const fechaStr = new Date(c.fecha_compra).toISOString().slice(0, 19).replace("T", " ");

    if (!isDryRun) {
      // Idempotencia preventiva por compra/variante/bodega
      const [[{ total_kardex }]] = await conn.execute(`
        SELECT COALESCE(SUM(cantidad), 0) AS total_kardex
        FROM movimientos_inventario
        WHERE id_variante = ? AND id_bodega = ?
          AND tipo = 'COMPRA' AND referencia_tipo = 'COMPRA' AND referencia_id = ?
      `, [id_variante, id_bodega, c.id_compra]);

      const yaRegistrado = r4(Number(total_kardex));
      const restante = r4(c.cantDetalle - yaRegistrado);

      if (restante > TOLERANCIA) {
        await conn.execute(`
          INSERT INTO movimientos_inventario
            (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
             motivo, referencia_tipo, referencia_id, usuario, fecha)
          VALUES (?, ?, 'COMPRA', ?, 0, 0,
                  ?, 'COMPRA', ?, 'SISTEMA', ?)
        `, [
          id_variante,
          id_bodega,
          restante,
          `Reconstrucción histórica compra ${c.numero_compra || c.id_compra}`,
          c.id_compra,
          fechaStr,
        ]);
        logs.push(`+ COMPRA #${c.id_compra} (${c.numero_compra}): ${restante}`);
      }
    } else {
      logs.push(`+ COMPRA #${c.id_compra} (${c.numero_compra}): ${cantInsertar}`);
    }
  }

  // C. Recargar todos los movimientos y recalcular la secuencia cronológica desde cero
  const [todosMovs] = await conn.execute(`
    SELECT id_movimiento, tipo, cantidad, fecha, motivo, referencia_tipo
    FROM movimientos_inventario
    WHERE id_variante = ? AND id_bodega = ?
    ORDER BY fecha ASC, id_movimiento ASC
  `, [id_variante, id_bodega]);

  let saldo = 0;
  const updates = [];
  let saldoNegativo = false;
  let detalleSaldoNegativo = null;

  for (const m of todosMovs) {
    const factor = getFactor(m.tipo);
    const cant = r4(m.cantidad);
    const stockAnt = r4(saldo);
    const stockNvo = r4(saldo + factor * cant);

    if (stockNvo < -TOLERANCIA) {
      saldoNegativo = true;
      detalleSaldoNegativo = {
        id_movimiento: m.id_movimiento,
        tipo: m.tipo,
        cant,
        stockAnt,
        stockNvo,
      };
      break;
    }

    const stockNvoLimpio = Math.abs(stockNvo) < TOLERANCIA ? 0 : stockNvo;
    updates.push({
      id_movimiento: m.id_movimiento,
      stockAnt,
      stockNvo: stockNvoLimpio,
    });
    saldo = stockNvoLimpio;
  }

  if (saldoNegativo) {
    return {
      ok: false,
      estado: "SALDO_NEGATIVO",
      error: `Saldo negativo en mov #${detalleSaldoNegativo.id_movimiento} (${detalleSaldoNegativo.tipo}): ${detalleSaldoNegativo.stockNvo}`,
      logs,
    };
  }

  // D. Validar obligatoriamente saldo final contra stock_producto
  const saldoFinal = r4(saldo);
  const diffFinal = r4(Math.abs(stock_fisico_final - saldoFinal));

  if (diffFinal > TOLERANCIA) {
    return {
      ok: false,
      estado: "DIFERENCIA_FINAL",
      error: `Saldo final (${saldoFinal}) != stock_producto (${stock_fisico_final}). Diferencia: ${r4(saldoFinal - stock_fisico_final)}`,
      logs,
    };
  }

  // E. En modo apply, actualizar stock_anterior y stock_nuevo recalculados
  if (!isDryRun) {
    for (const u of updates) {
      await conn.execute(`
        UPDATE movimientos_inventario
        SET stock_anterior = ?, stock_nuevo = ?
        WHERE id_movimiento = ?
      `, [u.stockAnt, u.stockNvo, u.id_movimiento]);
    }
  }

  logs.push(`✅ Recalculados ${updates.length} movimientos. Saldo final exacto: ${saldoFinal}`);

  return {
    ok: true,
    saldoFinal,
    movimientosProcesados: updates.length,
    logs,
  };
}

// ─── 8. FASE 4: Auditoría Post-Apply (Validaciones A–F) ───────────────────────

async function runPostAudit(pool) {
  const conn = await pool.getConnection();
  console.log("\n" + "=".repeat(85));
  console.log("  FASE 5 — AUDITORÍA FINAL DE VERIFICACIÓN (A–F)");
  console.log("=".repeat(85));

  try {
    // A. Compras detalle vs COMPRA Kardex
    const [compDiff] = await conn.execute(`
      SELECT 
        c.id_compra, c.numero_compra, dc.id_variante,
        SUM(dc.cantidad) AS cant_detalle,
        COALESCE(m.cant_kardex, 0) AS cant_kardex,
        ABS(SUM(dc.cantidad) - COALESCE(m.cant_kardex, 0)) AS dif
      FROM detalle_compras dc
      JOIN compras c ON c.id_compra = dc.id_compra
      LEFT JOIN (
        SELECT referencia_id, id_variante, SUM(cantidad) AS cant_kardex
        FROM movimientos_inventario
        WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA'
        GROUP BY referencia_id, id_variante
      ) m ON m.referencia_id = c.id_compra AND m.id_variante = dc.id_variante
      WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
      GROUP BY c.id_compra, c.numero_compra, dc.id_variante, m.cant_kardex
      HAVING dif > 0.0001
    `);
    const compOk = compDiff.length === 0;
    console.log(`  ${compOk ? "✅" : "❌"} A. Compras detalle vs Kardex COMPRA:       ${compDiff.length} diferencias`);

    // B. Ventas detalle vs VENTA Kardex
    const [ventDiff] = await conn.execute(`
      SELECT 
        v.id_venta, v.numero_venta, dv.id_variante,
        SUM(dv.cantidad) AS cant_detalle,
        COALESCE(m.cant_kardex, 0) AS cant_kardex,
        ABS(SUM(dv.cantidad) - COALESCE(m.cant_kardex, 0)) AS dif
      FROM detalle_ventas dv
      JOIN ventas v ON v.id_venta = dv.id_venta
      LEFT JOIN (
        SELECT referencia_id, id_variante, SUM(cantidad) AS cant_kardex
        FROM movimientos_inventario
        WHERE tipo = 'VENTA' AND referencia_tipo = 'VENTA'
        GROUP BY referencia_id, id_variante
      ) m ON m.referencia_id = v.id_venta AND m.id_variante = dv.id_variante
      WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
      GROUP BY v.id_venta, v.numero_venta, dv.id_variante, m.cant_kardex
      HAVING dif > 0.0001
    `);
    const ventOk = ventDiff.length === 0;
    console.log(`  ${ventOk ? "✅" : "❌"} B. Ventas detalle vs Kardex VENTA:         ${ventDiff.length} diferencias`);

    // C. Discontinuidades de Kardex (stock_nuevo[N] != stock_anterior[N+1])
    const [discont] = await conn.execute(`
      SELECT COUNT(*) AS total_discont
      FROM (
        SELECT 
          id_movimiento, id_variante, id_bodega, stock_anterior,
          LAG(stock_nuevo) OVER (
            PARTITION BY id_variante, id_bodega 
            ORDER BY fecha ASC, id_movimiento ASC
          ) AS stock_nuevo_previo
        FROM movimientos_inventario
      ) t
      WHERE stock_nuevo_previo IS NOT NULL
        AND ABS(stock_anterior - stock_nuevo_previo) > 0.0001
    `);
    const numDiscont = Number(discont[0]?.total_discont || 0);
    console.log(`  ${numDiscont === 0 ? "✅" : "❌"} C. Discontinuidades en el Kardex:           ${numDiscont} detectadas`);

    // D. Último stock_nuevo vs stock_producto
    const [ultDiff] = await conn.execute(`
      SELECT 
        sp.id_variante, sp.id_bodega, sp.cantidad AS stock_producto,
        last_m.stock_nuevo AS kardex_ultimo
      FROM stock_producto sp
      LEFT JOIN (
        SELECT m1.id_variante, m1.id_bodega, m1.stock_nuevo
        FROM movimientos_inventario m1
        JOIN (
          SELECT id_variante, id_bodega, MAX(id_movimiento) AS max_id
          FROM movimientos_inventario
          GROUP BY id_variante, id_bodega
        ) m2 ON m1.id_movimiento = m2.max_id
      ) last_m ON last_m.id_variante = sp.id_variante AND last_m.id_bodega = sp.id_bodega
      WHERE ABS(sp.cantidad - COALESCE(last_m.stock_nuevo, 0)) > 0.0001
    `);
    const ultOk = ultDiff.length === 0;
    console.log(`  ${ultOk ? "✅" : "❌"} D. Último stock_nuevo vs stock_producto:     ${ultDiff.length} diferencias`);

    // E. Stocks negativos en stock_producto o en stock_nuevo del Kardex
    const [negStock] = await conn.execute(`
      SELECT COUNT(*) AS n FROM stock_producto WHERE cantidad < 0
    `);
    const [negKardex] = await conn.execute(`
      SELECT COUNT(*) AS n FROM movimientos_inventario WHERE stock_nuevo < -0.0001
    `);
    const numNeg = Number(negStock[0]?.n || 0) + Number(negKardex[0]?.n || 0);
    console.log(`  ${numNeg === 0 ? "✅" : "❌"} E. Stocks negativos detectados:              ${numNeg}`);

    // F. Duplicados en stock_producto por variante/bodega
    const [dupStock] = await conn.execute(`
      SELECT id_variante, id_bodega, COUNT(*) AS cnt
      FROM stock_producto
      GROUP BY id_variante, id_bodega
      HAVING cnt > 1
    `);
    const dupOk = dupStock.length === 0;
    console.log(`  ${dupOk ? "✅" : "❌"} F. Duplicados en stock_producto:            ${dupStock.length}`);

    // Resumen Consolidado ∑
    const [sumRes] = await conn.execute(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) <= 0.0001 THEN 1 ELSE 0 END) AS consistentes,
        SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) > 0.0001 THEN 1 ELSE 0 END) AS inconsistentes
      FROM stock_producto sp
      LEFT JOIN (
        SELECT 
          id_variante, id_bodega,
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
    `);

    const tot = Number(sumRes[0]?.total || 0);
    const cons = Number(sumRes[0]?.consistentes || 0);
    const incons = Number(sumRes[0]?.inconsistentes || 0);

    console.log("─".repeat(85));
    console.log(`  📊 RESUMEN FINAL: ${cons}/${tot} Variantes Consistentes (${incons} inconsistentes)`);
    console.log("=".repeat(85) + "\n");

    const allPassed = compOk && ventOk && numDiscont === 0 && ultOk && numNeg === 0 && dupOk && incons === 0;
    if (allPassed) {
      console.log("  🎉 ¡ÉXITO TOTAL! ESTADO GENERAL = OK (100% Consistente e Idempotente)\n");
    } else {
      console.log("  ⚠️  Se detectaron observaciones en la auditoría final.\n");
    }

    return allPassed;
  } finally {
    conn.release();
  }
}

// ─── 9. Función Principal de Orquestación ─────────────────────────────────────

async function main() {
  const ts = nowTs();
  console.log("=".repeat(85));
  console.log("  RECONSTRUCCIÓN HISTÓRICA DEL KARDEX — L&F HOME DECOR / MI HOGAR Y CONFORT");
  console.log(`  MODO: ${IS_DRY_RUN ? "🔍 DRY-RUN (Simulación segura sin alterar datos)" : "⚠️  APPLY (Modificación controlada y respaldada)"}`);
  console.log(`  BASE DE DATOS: ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log("=".repeat(85));

  let pool;
  try {
    pool = mysql.createPool(DB_CONFIG);
    const testConn = await pool.getConnection();
    await testConn.execute("SELECT 1");
    testConn.release();
    console.log(`  Conexión a MySQL establecida correctamente.\n`);
  } catch (err) {
    console.error("❌ No se pudo conectar a MySQL:", err.message);
    process.exit(1);
  }

  try {
    // ── FASE 0: Backup (solo en modo --apply) ─────────────────────────────────
    if (IS_APPLY) {
      await createBackup(pool, ts);
    }

    // ── FASE 1 & 2: Carga y Análisis ──────────────────────────────────────────
    console.log("⏳ Leyendo fuentes de compras, ventas y movimientos existentes...");
    const sources = await loadSources(pool);
    const analysis = analyzeHistoricalData(sources);
    console.log(`   Analizadas ${analysis.length} variantes/bodegas registradas.\n`);

    // ── FASE 3: Mostrar Tabla Detallada (Requisito 11) ─────────────────────────
    console.log("📋 REPORTE TABULAR DETALLADO:\n");
    console.table(
      analysis.map((r) => ({
        "ID_V": r.id_variante,
        "Producto": r.producto.slice(0, 24),
        "Bodega": r.bodega.slice(0, 10),
        "Stock_Fisico": r.stock_fisico_final,
        "INICIAL_calc": r.inventario_inicial_calculado,
        "Compras_tot": r.total_compras,
        "Ventas_tot": r.total_ventas,
        "Otras_Ent": r.otras_entradas,
        "Otras_Sal": r.otras_salidas,
        "Compras_falt": r.compras_faltantes_total,
        "Saldo_rec": r.saldo_reconstruido,
        "Diferencia": r.diferencia,
        "Estado": r.estado,
      }))
    );

    const requierenAccion = analysis.filter((a) => a.estado !== "OK");
    const requierenRevision = analysis.filter((a) => a.estado === "REQUIERE_REVISION");

    if (requierenRevision.length > 0) {
      console.log("\n⛔ VARIANTES QUE REQUIEREN REVISIÓN MANUAL (INICIAL < 0):");
      for (const r of requierenRevision) {
        console.log(`   • [ID ${r.id_variante}] ${r.producto}: Inicial calculado = ${r.inventario_inicial_calculado}`);
      }
      console.log("");
    }

    // ── MODO DRY-RUN: Simulación ──────────────────────────────────────────────
    if (IS_DRY_RUN) {
      console.log("\n🔍 SIMULACIÓN DRY-RUN DE RECONSTRUCCIÓN:");
      for (const item of analysis) {
        if (item.estado === "OK") {
          console.log(`  ✅ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → Ya consistente (Saldo: ${item.stock_fisico_final})`);
          continue;
        }
        if (item.estado === "REQUIERE_REVISION") {
          console.log(`  ⛔ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → Omitido (Requiere revisión manual)`);
          continue;
        }

        const simConn = await pool.getConnection();
        try {
          const simRes = await reconstructVariant(simConn, item, true);
          const icon = simRes.ok ? "✅" : "❌";
          console.log(`  ${icon} [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → Simulado OK (Saldo: ${item.stock_fisico_final})`);
          for (const l of simRes.logs || []) {
            console.log(`       ${l}`);
          }
          if (!simRes.ok) {
            console.log(`       ERROR: ${simRes.error}`);
          }
        } finally {
          simConn.release();
        }
      }

      console.log("\n" + "─".repeat(85));
      console.log("  Para aplicar estos cambios en la base de datos ejecuta:");
      console.log("    node scripts/rebuild-historical-kardex.mjs --apply");
      console.log("─".repeat(85) + "\n");
      return;
    }

    // ── MODO APPLY: Confirmación y Ejecución ──────────────────────────────────
    const respuesta = await ask(
      `\n⚠️  ATENCIÓN: Vas a reconstruir el Kardex en "${DB_CONFIG.database}".\n   Se creará respaldo y se mantendrán los saldos físicos.\n   ¿Confirmas la operación? (escribe "si"): `
    );

    if (respuesta !== "si") {
      console.log("\n🚫 Operación cancelada por el usuario.\n");
      return;
    }

    console.log("\n🚀 APLICANDO RECONSTRUCCIÓN (Transacción independiente por variante/bodega)...");
    let okCount = 0;
    let errCount = 0;
    let skipCount = 0;

    for (const item of analysis) {
      if (item.estado === "OK") {
        okCount++;
        console.log(`  ✅ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → Ya consistente (Sin cambios requeridos)`);
        continue;
      }
      if (item.estado === "REQUIERE_REVISION") {
        skipCount++;
        console.log(`  ⏭️  [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → Omitido por requerir revisión`);
        continue;
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const res = await reconstructVariant(conn, item, false);

        if (res.ok) {
          await conn.commit();
          okCount++;
          console.log(`  ✅ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → RECONSTRUIDO EXITOSAMENTE (Saldo: ${res.saldoFinal})`);
          for (const l of res.logs || []) {
            console.log(`       ${l}`);
          }
        } else {
          await conn.rollback();
          errCount++;
          console.log(`  ❌ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → ROLLBACK: ${res.error}`);
        }
      } catch (err) {
        await conn.rollback();
        errCount++;
        console.log(`  ❌ [ID ${item.id_variante}] ${item.producto.slice(0, 28)} → EXCEPCIÓN ROLLBACK: ${err.message}`);
      } finally {
        conn.release();
      }
    }

    console.log("\n" + "─".repeat(85));
    console.log(`  RESUMEN DE RECONSTRUCCIÓN:`);
    console.log(`  ✅ Exitosos (OK o reconstruidos): ${okCount}`);
    console.log(`  ❌ Fallidos (ROLLBACK):          ${errCount}`);
    console.log(`  ⏭️  Omitidos (revisión manual):   ${skipCount}`);
    console.log("─".repeat(85));

    // Guardar reporte JSON
    try {
      const tmpDir = resolve(process.cwd(), "tmp");
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
      const reportFile = resolve(tmpDir, `rebuild_historical_kardex_${ts}.json`);
      writeFileSync(reportFile, JSON.stringify(analysis, null, 2));
      console.log(`\n📄 Reporte JSON de auditoría guardado en: ${reportFile}`);
    } catch {}

    // ── FASE 5: Auditoría Post-Apply ──────────────────────────────────────────
    await runPostAudit(pool);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Error fatal no controlado:", err.message);
  process.exit(1);
});
