/**
 * ============================================================================
 * RECONSTRUCCIÓN HISTÓRICA DEL KARDEX — L&F HOME DECOR / MI HOGAR Y CONFORT
 * ============================================================================
 *
 * Modos de uso:
 *   node scripts/rebuild-inventory-kardex.mjs            → dry-run (solo simula)
 *   node scripts/rebuild-inventory-kardex.mjs --dry-run  → dry-run (solo simula)
 *   node scripts/rebuild-inventory-kardex.mjs --apply    → aplica cambios reales
 *
 * REGLAS ABSOLUTAS:
 *   ✅ NO modifica stock_producto.cantidad
 *   ✅ NO borra movimientos existentes
 *   ✅ NO repite movimientos (idempotente)
 *   ✅ ROLLBACK por variante/bodega si el saldo final no coincide
 *   ✅ Backup obligatorio antes de --apply
 * ============================================================================
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

// ─── Carga de entorno ─────────────────────────────────────────────────────────

function loadEnv() {
  for (const file of [".env.production", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (!existsSync(fullPath)) continue;
    try {
      for (const line of readFileSync(fullPath, "utf-8").split("\n")) {
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

// ─── Configuración ────────────────────────────────────────────────────────────

const IS_DRY_RUN = !process.argv.includes("--apply");

const DB_CONFIG = {
  host:             process.env.DB_HOST     || "localhost",
  port:       Number(process.env.DB_PORT    || "3306"),
  user:             process.env.DB_USER     || "root",
  password:         process.env.DB_PASSWORD || "",
  database:         process.env.DB_NAME     || "lf_home_decor",
  waitForConnections: true,
  connectionLimit: 3,
  decimalNumbers: true,
  multipleStatements: false,
};

const TOLERANCIA = 0.0001;

// ─── Catálogo de tipos ────────────────────────────────────────────────────────

const INCOMING_TYPES = new Set([
  "INICIAL", "ENTRADA_INICIAL",
  "COMPRA", "ENTRADA",
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

function getFactor(tipo) {
  if (INCOMING_TYPES.has(tipo)) return 1;
  if (OUTGOING_TYPES.has(tipo)) return -1;
  return 0;
}

// ─── Estados posibles por variante/bodega ────────────────────────────────────

const ESTADOS = {
  OK:                    "OK",
  REQUIERE_INICIAL:      "REQUIERE_INICIAL",
  REQUIERE_COMPRAS:      "REQUIERE_COMPRAS",
  SOBREREGISTRO_COMPRA:  "SOBREREGISTRO_COMPRA",
  SALDO_NEGATIVO:        "SALDO_NEGATIVO",
  BODEGA_AMBIGUA:        "BODEGA_AMBIGUA",
  DIFERENCIA_FINAL:      "DIFERENCIA_FINAL",
  REQUIERE_REVISION:     "REQUIERE_REVISION",
  LISTO_PARA_RECONSTRUIR:"LISTO_PARA_RECONSTRUIR",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }

function nowTs() {
  const d = new Date();
  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans.trim().toLowerCase()); }));
}

// ─── FASE 0: BACKUP ───────────────────────────────────────────────────────────

async function createBackup(pool) {
  const ts = nowTs();
  const tables = ["movimientos_inventario", "stock_producto", "compras", "detalle_compras"];
  console.log(`\n📦 FASE 0 — Creando backups (sufijo: ${ts})...`);
  const conn = await pool.getConnection();
  try {
    for (const tbl of tables) {
      const name = `${tbl}_backup_${ts}`;
      try {
        await conn.execute(`CREATE TABLE IF NOT EXISTS \`${name}\` LIKE \`${tbl}\``);
        await conn.execute(`INSERT IGNORE INTO \`${name}\` SELECT * FROM \`${tbl}\``);
        const [[{ n }]] = await conn.execute(`SELECT COUNT(*) AS n FROM \`${name}\``);
        console.log(`  ✅ ${name} (${n} filas)`);
      } catch (e) {
        const msg = `  ❌ No se pudo respaldar ${tbl}: ${e.message}`;
        console.error(msg);
        throw new Error(`Backup fallido — ${msg}. Abortando --apply por seguridad.`);
      }
    }
  } finally {
    conn.release();
  }
  console.log("  Backups completos.\n");
}

// ─── CARGA DE DATOS BASE ──────────────────────────────────────────────────────

async function loadBaseData(pool) {
  const conn = await pool.getConnection();
  try {
    // Stock productos
    const [stocks] = await conn.execute(`
      SELECT sp.id_variante, sp.id_bodega, sp.id_stock, sp.cantidad AS stock_actual,
             p.descripcion AS producto, vp.codigo_gs1, vp.codigo_interno,
             b.nombre AS bodega, b.id_local
      FROM stock_producto sp
      JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
      JOIN productos p ON p.id_producto = vp.id_producto
      JOIN bodegas b ON b.id_bodega = sp.id_bodega
      ORDER BY sp.id_variante, sp.id_bodega
    `);

    // Movimientos existentes completos
    const [movs] = await conn.execute(`
      SELECT id_movimiento, id_variante, id_bodega, tipo, cantidad,
             stock_anterior, stock_nuevo, fecha, referencia_tipo, referencia_id
      FROM movimientos_inventario
      ORDER BY id_variante, id_bodega, fecha ASC, id_movimiento ASC
    `);

    // Compras activas agrupadas por id_compra/id_variante
    const [compras] = await conn.execute(`
      SELECT c.id_compra, c.numero_compra, c.fecha AS fecha_compra,
             c.id_local AS local_compra,
             dc.id_variante,
             SUM(dc.cantidad) AS cantidad_detalle
      FROM detalle_compras dc
      JOIN compras c ON c.id_compra = dc.id_compra
      WHERE c.estado != 'ANULADA'
      GROUP BY c.id_compra, c.numero_compra, c.fecha, c.id_local, dc.id_variante
      ORDER BY c.fecha ASC, c.id_compra ASC
    `);

    // Bodegas activas por local
    const [bodegas] = await conn.execute(`
      SELECT id_bodega, id_local, nombre FROM bodegas
      WHERE activo = 1
      ORDER BY id_local, id_bodega ASC
    `);

    return { stocks, movs, compras, bodegas };
  } finally {
    conn.release();
  }
}

// ─── FASE 1: ANÁLISIS POR VARIANTE/BODEGA ────────────────────────────────────

function analyzeAll({ stocks, movs, compras, bodegas }) {

  // Índice de movimientos por variante/bodega
  const movIdx = new Map();
  for (const m of movs) {
    const k = `${m.id_variante}:${m.id_bodega}`;
    if (!movIdx.has(k)) movIdx.set(k, []);
    movIdx.get(k).push(m);
  }

  // Índice de bodegas por local (local → [id_bodega, ...])
  const bodegasByLocal = new Map();
  for (const b of bodegas) {
    const li = Number(b.id_local);
    if (!bodegasByLocal.has(li)) bodegasByLocal.set(li, []);
    bodegasByLocal.get(li).push(Number(b.id_bodega));
  }

  // Movimientos COMPRA existentes: key = `id_compra:id_variante:id_bodega` → cantidad_kardex
  const compraMovIdx = new Map();
  for (const m of movs) {
    if (m.tipo === "COMPRA" && m.referencia_tipo === "COMPRA" && m.referencia_id) {
      const k = `${m.referencia_id}:${m.id_variante}:${m.id_bodega}`;
      compraMovIdx.set(k, r4((compraMovIdx.get(k) || 0) + Number(m.cantidad)));
    }
  }

  // Tiene INICIAL: key = `id_variante:id_bodega`
  const tieneInicialSet = new Set();
  for (const m of movs) {
    if (m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL") {
      tieneInicialSet.add(`${m.id_variante}:${m.id_bodega}`);
    }
  }

  const results = [];

  for (const stock of stocks) {
    const idV = Number(stock.id_variante);
    const idB = Number(stock.id_bodega);
    const idL = Number(stock.id_local);
    const stockActual = r4(stock.stock_actual);
    const key = `${idV}:${idB}`;

    const movsVB = movIdx.get(key) || [];

    // ── Acumuladores desde movimientos existentes ─────────────────────────────
    let comprasKardex  = 0; // COMPRA en kardex
    let ventasKardex   = 0; // VENTA en kardex
    let otrasEntradas  = 0; // todo lo que no es INICIAL ni COMPRA ni VENTA
    let otrasSalidas   = 0;

    for (const m of movsVB) {
      const tipo = m.tipo;
      const cant = r4(Number(m.cantidad));
      if (tipo === "INICIAL" || tipo === "ENTRADA_INICIAL") continue; // no suma en ecuación
      if (tipo === "COMPRA")       { comprasKardex  = r4(comprasKardex + cant); continue; }
      if (tipo === "VENTA")        { ventasKardex   = r4(ventasKardex  + cant); continue; }
      const f = getFactor(tipo);
      if (f > 0) otrasEntradas = r4(otrasEntradas + cant);
      if (f < 0) otrasSalidas  = r4(otrasSalidas  + cant);
    }

    // ── Compras válidas desde detalle_compras (fuente oficial) ────────────────
    const comprasVariante = compras.filter(c =>
      Number(c.id_variante) === idV
    );

    // Determinar cuáles corresponden a esta bodega
    const bodegasLocal = bodegasByLocal.get(idL) || [];
    const bodegaEsAmbigua = bodegasLocal.length !== 1;

    let comprasDetalle    = 0; // SUM desde detalle_compras para esta variante
    let comprasFaltantes  = []; // compras que faltan o tienen déficit en Kardex
    let hayOverregistro   = false;
    let hayBodegaAmbigua  = false;

    for (const c of comprasVariante) {
      const localCompra = Number(c.local_compra);
      const bodegasCompra = bodegasByLocal.get(localCompra) || [];

      if (bodegasCompra.length === 0) {
        hayBodegaAmbigua = true;
        continue;
      }
      if (bodegasCompra.length > 1) {
        hayBodegaAmbigua = true;
        continue;
      }

      const bodegaCompra = bodegasCompra[0];
      if (bodegaCompra !== idB) continue; // pertenece a otra bodega

      const cantDetalle = r4(Number(c.cantidad_detalle));
      comprasDetalle = r4(comprasDetalle + cantDetalle);

      const movKey = `${c.id_compra}:${idV}:${idB}`;
      const cantKardex = compraMovIdx.get(movKey) || 0;

      if (r4(cantKardex - cantDetalle) > TOLERANCIA) {
        // kardex > detalle → SOBREREGISTRO
        hayOverregistro = true;
        comprasFaltantes.push({ ...c, bodega_destino: idB, cantDetalle, cantKardex, diferencia: r4(cantKardex - cantDetalle), sobreregistro: true });
      } else if (r4(cantDetalle - cantKardex) > TOLERANCIA) {
        // detalle > kardex → falta en kardex
        comprasFaltantes.push({ ...c, bodega_destino: idB, cantDetalle, cantKardex, diferencia: r4(cantDetalle - cantKardex), sobreregistro: false });
      }
      // si son iguales, no agrega nada
    }

    // ── INICIAL estimado (según fórmula exacta del enunciado) ─────────────────
    // INICIAL = stock_actual - comprasDetalle + ventasKardex - otrasEntradas + otrasSalidas
    const inicialEstimado = r4(stockActual - comprasDetalle + ventasKardex - otrasEntradas + otrasSalidas);

    // ── Estado ────────────────────────────────────────────────────────────────
    let estado;
    const tieneInicial = tieneInicialSet.has(key);
    const faltaCompras = comprasFaltantes.filter(c => !c.sobreregistro).length > 0;

    if (hayBodegaAmbigua) {
      estado = ESTADOS.BODEGA_AMBIGUA;
    } else if (hayOverregistro) {
      estado = ESTADOS.SOBREREGISTRO_COMPRA;
    } else if (inicialEstimado < -TOLERANCIA) {
      estado = ESTADOS.REQUIERE_REVISION;
    } else {
      // Simular saldo sin tocar BD para ver si hay saldo negativo
      // (se hace luego en reconstructVariante)
      if (!tieneInicial && inicialEstimado > TOLERANCIA && faltaCompras) {
        estado = ESTADOS.LISTO_PARA_RECONSTRUIR;
      } else if (!tieneInicial && inicialEstimado > TOLERANCIA) {
        estado = ESTADOS.REQUIERE_INICIAL;
      } else if (faltaCompras) {
        estado = ESTADOS.REQUIERE_COMPRAS;
      } else {
        estado = ESTADOS.OK;
      }
    }

    // Saldo reconstruido estimado (para dry-run display)
    const saldoReconstruido = r4(
      (inicialEstimado > TOLERANCIA && !tieneInicial ? inicialEstimado : 0)
      + (tieneInicial ? (movsVB.find(m => m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL")
          ? r4(movsVB.filter(m => m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL").reduce((s, m) => s + Number(m.cantidad), 0))
          : 0)
        : 0)
      + comprasDetalle
      + otrasEntradas
      - ventasKardex
      - otrasSalidas
    );
    const diferenciaFinal = r4(stockActual - saldoReconstruido);

    // Primera fecha de evento (para posicionar INICIAL)
    const fechas = [
      ...movsVB.map(m => new Date(m.fecha).getTime()),
      ...comprasVariante.map(c => new Date(c.fecha_compra).getTime()),
    ].filter(t => !isNaN(t));
    const primeraFecha = fechas.length > 0 ? new Date(Math.min(...fechas)) : new Date("2020-01-01T00:00:00");

    results.push({
      id_variante: idV,
      id_bodega: idB,
      id_local: idL,
      producto: stock.producto,
      codigo: stock.codigo_gs1 || stock.codigo_interno || `V${idV}`,
      bodega: stock.bodega,
      stockActual,
      inicialEstimado,
      tieneInicial,
      comprasDetalle,
      comprasKardex,
      comprasFaltantes,
      ventasKardex,
      otrasEntradas,
      otrasSalidas,
      saldoReconstruido,
      diferenciaFinal,
      estado,
      movsVB,
      primeraFecha,
    });
  }

  return results;
}

// ─── FASE 3: RECONSTRUCCIÓN DE UNA VARIANTE/BODEGA ───────────────────────────

async function reconstructVariante(conn, item, dryRun) {
  const {
    id_variante, id_bodega, producto,
    tieneInicial, inicialEstimado, comprasFaltantes,
    movsVB, primeraFecha, stockActual, estado,
  } = item;

  const acciones = [];

  // ── 1. Insertar INICIAL si corresponde ────────────────────────────────────
  if (!tieneInicial && inicialEstimado > TOLERANCIA) {
    const fechaInicial = new Date(primeraFecha.getTime() - 1000);
    const fechaStr = fechaInicial.toISOString().slice(0, 19).replace("T", " ");

    if (!dryRun) {
      // Idempotencia: verificar que no exista ya
      const [[{ cnt }]] = await conn.execute(`
        SELECT COUNT(*) AS cnt FROM movimientos_inventario
        WHERE id_variante = ? AND id_bodega = ?
          AND (tipo = 'INICIAL' OR tipo = 'ENTRADA_INICIAL')
      `, [id_variante, id_bodega]);

      if (Number(cnt) === 0) {
        await conn.execute(`
          INSERT INTO movimientos_inventario
            (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
             motivo, referencia_tipo, referencia_id, usuario, fecha)
          VALUES (?, ?, 'INICIAL', ?, 0, ?,
                  'Reconstrucción histórica de inventario inicial',
                  'RECONSTRUCCION_INICIAL', NULL, NULL, ?)
        `, [id_variante, id_bodega, r4(inicialEstimado), r4(inicialEstimado), fechaStr]);
      }
    }
    acciones.push(`INICIAL +${r4(inicialEstimado)} @ ${fechaStr}`);
  }

  // ── 2. Insertar COMPRAs faltantes ──────────────────────────────────────────
  for (const c of comprasFaltantes.filter(fc => !fc.sobreregistro)) {
    const cantInsertar = r4(c.diferencia); // diferencia = detalle - kardex
    const fechaStr = new Date(c.fecha_compra).toISOString().slice(0, 19).replace("T", " ");

    if (!dryRun) {
      // Idempotencia: verificar si YA existe movimiento COMPRA exacto para esta compra/variante/bodega
      // con la misma cantidad de diferencia (evitar duplicados en doble ejecución)
      const [[{ total_kardex }]] = await conn.execute(`
        SELECT COALESCE(SUM(cantidad), 0) AS total_kardex
        FROM movimientos_inventario
        WHERE id_variante = ? AND id_bodega = ?
          AND tipo = 'COMPRA' AND referencia_tipo = 'COMPRA' AND referencia_id = ?
      `, [id_variante, id_bodega, c.id_compra]);

      const yaRegistrado = r4(Number(total_kardex));
      const necesario = r4(c.cantDetalle - yaRegistrado);

      if (necesario > TOLERANCIA) {
        await conn.execute(`
          INSERT INTO movimientos_inventario
            (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
             motivo, referencia_tipo, referencia_id, usuario, fecha)
          VALUES (?, ?, 'COMPRA', ?, 0, 0,
                  ?, 'COMPRA', ?, NULL, ?)
        `, [
          id_variante,
          c.bodega_destino,
          necesario,
          `Compra histórica ${c.numero_compra || c.id_compra}`,
          c.id_compra,
          fechaStr,
        ]);
        acciones.push(`COMPRA #${c.id_compra} (${c.numero_compra || "s/n"}) +${necesario} @ ${fechaStr}`);
      } else {
        acciones.push(`COMPRA #${c.id_compra} ya cubierta (idempotente)`);
      }
    } else {
      acciones.push(`COMPRA #${c.id_compra} (${c.numero_compra || "s/n"}) +${cantInsertar} @ ${fechaStr}`);
    }
  }

  // ── 3. Recargar todos los movimientos y recalcular secuencia ──────────────
  const [todosMovs] = await conn.execute(`
    SELECT id_movimiento, tipo, cantidad, fecha
    FROM movimientos_inventario
    WHERE id_variante = ? AND id_bodega = ?
    ORDER BY fecha ASC, id_movimiento ASC
  `, [id_variante, id_bodega]);

  let saldo = 0;
  const actualizaciones = [];
  let errorSaldoNegativo = null;

  for (const m of todosMovs) {
    const factor = getFactor(m.tipo);
    const cant = r4(Number(m.cantidad));
    const stockAnt = r4(saldo);
    const stockNvo = r4(saldo + factor * cant);

    if (stockNvo < -TOLERANCIA) {
      errorSaldoNegativo = {
        id_movimiento: m.id_movimiento,
        tipo: m.tipo,
        cant,
        stockAnt,
        stockNvo,
      };
      break;
    }

    const stockNvoFinal = Math.abs(stockNvo) < TOLERANCIA ? 0 : stockNvo;
    actualizaciones.push({ id_movimiento: m.id_movimiento, stockAnt, stockNvo: stockNvoFinal });
    saldo = stockNvoFinal;
  }

  if (errorSaldoNegativo) {
    return {
      ok: false,
      estado: ESTADOS.SALDO_NEGATIVO,
      message: `Saldo negativo en mov #${errorSaldoNegativo.id_movimiento} (${errorSaldoNegativo.tipo}): ${errorSaldoNegativo.stockNvo}`,
      acciones,
    };
  }

  // ── 4. Validar saldo final ────────────────────────────────────────────────
  const saldoFinal = r4(saldo);
  const diff = r4(Math.abs(stockActual - saldoFinal));

  if (diff > TOLERANCIA) {
    return {
      ok: false,
      estado: ESTADOS.DIFERENCIA_FINAL,
      message: `Saldo reconstruido (${saldoFinal}) ≠ stock_producto (${stockActual}). Diferencia: ${r4(saldoFinal - stockActual)}`,
      saldoFinal,
      diff,
      acciones,
    };
  }

  // ── 5. Aplicar stock_anterior / stock_nuevo ───────────────────────────────
  if (!dryRun) {
    for (const u of actualizaciones) {
      await conn.execute(`
        UPDATE movimientos_inventario
        SET stock_anterior = ?, stock_nuevo = ?
        WHERE id_movimiento = ?
      `, [u.stockAnt, u.stockNvo, u.id_movimiento]);
    }
  }

  acciones.push(`Recalculados ${actualizaciones.length} movimientos → saldo final: ${saldoFinal}`);

  return { ok: true, acciones, saldoFinal, diff, movimientosRecalculados: actualizaciones.length };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(80));
  console.log("  RECONSTRUCCIÓN DEL KARDEX — L&F HOME DECOR / MI HOGAR Y CONFORT");
  console.log(`  MODO: ${IS_DRY_RUN ? "DRY-RUN (solo simulación, no modifica la BD)" : "⚠️  APPLY — SE ESCRIBIRÁN CAMBIOS REALES"}`);
  console.log("=".repeat(80));

  let pool;
  try {
    pool = mysql.createPool(DB_CONFIG);
    const c = await pool.getConnection();
    await c.execute("SELECT 1");
    c.release();
    console.log(`\n✅ Conexión OK → ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}\n`);
  } catch (err) {
    console.error("❌ No se pudo conectar a MySQL:", err.message);
    process.exit(1);
  }

  try {
    // ── Backup (solo --apply) ────────────────────────────────────────────────
    if (!IS_DRY_RUN) {
      await createBackup(pool);
    }

    // ── FASE 1: Análisis ─────────────────────────────────────────────────────
    console.log("⏳ FASE 1 — Cargando datos y analizando...");
    const data = await loadBaseData(pool);
    const results = analyzeAll(data);
    console.log(`   Combinaciones variante/bodega: ${results.length}\n`);

    // ── Resumen por estado ───────────────────────────────────────────────────
    const byEstado = {};
    for (const r of results) byEstado[r.estado] = (byEstado[r.estado] || 0) + 1;

    console.log("─".repeat(80));
    console.log("  RESUMEN POR ESTADO");
    console.log("─".repeat(80));
    for (const [est, cnt] of Object.entries(byEstado)) {
      const ico = est === ESTADOS.OK ? "✅" : est.includes("REVISION") || est.includes("SOBRE") || est.includes("AMBIGUA") ? "⛔" : "🔧";
      console.log(`  ${ico} ${est.padEnd(30)} ${cnt}`);
    }
    console.log("─".repeat(80) + "\n");

    // ── Tabla detallada (dry-run always, apply also) ─────────────────────────
    console.log("📋 DETALLE POR VARIANTE/BODEGA:\n");
    console.table(results.map(r => ({
      "ID_V": r.id_variante,
      "ID_B": r.id_bodega,
      "Producto":          r.producto.slice(0, 24),
      "Bodega":            r.bodega.slice(0, 12),
      "Stock":             r.stockActual,
      "INICIAL_est":       r.inicialEstimado,
      "Compras_det":       r.comprasDetalle,
      "Compras_kdx":       r.comprasKardex,
      "C_faltantes":       r.comprasFaltantes.filter(c => !c.sobreregistro).reduce((s, c) => r4(s + c.diferencia), 0),
      "Ventas":            r.ventasKardex,
      "Otras_E":           r.otrasEntradas,
      "Otras_S":           r.otrasSalidas,
      "Saldo_rec":         r.saldoReconstruido,
      "Diferencia":        r.diferenciaFinal,
      "Estado":            r.estado,
    })));

    const necesitan = results.filter(r => r.estado !== ESTADOS.OK);
    const saltados  = results.filter(r => [ESTADOS.BODEGA_AMBIGUA, ESTADOS.SOBREREGISTRO_COMPRA, ESTADOS.REQUIERE_REVISION].includes(r.estado));

    if (saltados.length > 0) {
      console.log("\n⛔ REQUIEREN REVISIÓN MANUAL:\n");
      for (const r of saltados) {
        console.log(`  [${r.id_variante}:${r.id_bodega}] ${r.producto.slice(0, 30)} → ${r.estado}`);
        if (r.estado === ESTADOS.SOBREREGISTRO_COMPRA) {
          for (const c of r.comprasFaltantes.filter(f => f.sobreregistro)) {
            console.log(`       Compra #${c.id_compra}: detalle=${c.cantDetalle} kardex=${c.cantKardex} (EXCESO=${c.diferencia})`);
          }
        }
      }
    }

    // ── DRY-RUN: simular reconstrucción ─────────────────────────────────────
    if (IS_DRY_RUN) {
      console.log("\n⏳ FASE 3 (simulación) — Verificando secuencia sin modificar BD...\n");

      for (const item of necesitan) {
        if ([ESTADOS.BODEGA_AMBIGUA, ESTADOS.SOBREREGISTRO_COMPRA, ESTADOS.REQUIERE_REVISION].includes(item.estado)) continue;

        const simConn = await pool.getConnection();
        try {
          const sim = await reconstructVariante(simConn, item, true);
          const ico = sim.ok ? "✅" : "❌";
          console.log(`  ${ico} [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 28)}`);
          if (sim.acciones?.length) {
            for (const a of sim.acciones) console.log(`       → ${a}`);
          }
          if (!sim.ok) console.log(`       ERROR: ${sim.message}`);
        } finally {
          simConn.release();
        }
      }

      console.log("\n" + "─".repeat(80));
      console.log("  Para aplicar los cambios ejecuta:");
      console.log("    node scripts/rebuild-inventory-kardex.mjs --apply");
      console.log("─".repeat(80) + "\n");
      return;
    }

    // ── APPLY: aplicar cambios ────────────────────────────────────────────────
    const ans = await ask(
      `\n⚠️  Estás a punto de modificar la BD "${DB_CONFIG.database}". ¿Confirmas? (escribe "si"): `
    );
    if (ans !== "si") {
      console.log("\n🚫 Cancelado por el usuario.");
      return;
    }

    console.log("\n⏳ FASE 3 — Aplicando reconstrucción (transacción por variante/bodega)...\n");

    const applyResults = [];
    let okCount = 0, errCount = 0, skipCount = 0;

    for (const item of results) {
      if (item.estado === ESTADOS.OK) {
        okCount++;
        applyResults.push({ ...item, result: { ok: true, message: "Consistente – sin cambios" } });
        continue;
      }
      if ([ESTADOS.BODEGA_AMBIGUA, ESTADOS.SOBREREGISTRO_COMPRA, ESTADOS.REQUIERE_REVISION].includes(item.estado)) {
        skipCount++;
        applyResults.push({ ...item, result: { ok: false, skipped: true, message: `Omitido (${item.estado})` } });
        continue;
      }

      const conn = await pool.getConnection();
      let result;
      try {
        await conn.beginTransaction();
        result = await reconstructVariante(conn, item, false);
        if (result.ok) {
          await conn.commit();
          okCount++;
          console.log(`  ✅ [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 28)} → ${result.acciones?.slice(-1)[0] || "OK"}`);
        } else {
          await conn.rollback();
          errCount++;
          console.log(`  ❌ [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 28)} → ROLLBACK: ${result.message}`);
        }
      } catch (err) {
        await conn.rollback();
        result = { ok: false, message: err.message };
        errCount++;
        console.log(`  ❌ [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 28)} → EXCEPCION: ${err.message}`);
      } finally {
        conn.release();
      }
      applyResults.push({ ...item, result });
    }

    console.log("\n" + "=".repeat(80));
    console.log("  RESULTADO FINAL");
    console.log("=".repeat(80));
    console.log(`  ✅ Exitosos (OK + reconstruidos): ${okCount}`);
    console.log(`  ❌ Con error (ROLLBACK):           ${errCount}`);
    console.log(`  ⏭️  Omitidos (revisión manual):    ${skipCount}`);
    console.log("=".repeat(80) + "\n");

    if (errCount > 0) {
      console.log("⚠️  Variantes con error (requieren revisión manual):");
      for (const r of applyResults.filter(x => !x.result.ok && !x.result.skipped)) {
        console.log(`  [${r.id_variante}:${r.id_bodega}] ${r.producto} → ${r.result.message}`);
      }
      console.log("");
    }

    // Exportar reporte JSON
    try {
      const tmpDir = resolve(process.cwd(), "tmp");
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
      const reportPath = resolve(tmpDir, `kardex_rebuild_${nowTs()}.json`);
      writeFileSync(reportPath, JSON.stringify(
        applyResults.map(r => ({
          id_variante: r.id_variante, id_bodega: r.id_bodega,
          producto: r.producto, bodega: r.bodega,
          estado_inicial: r.estado,
          stock_actual: r.stockActual,
          inicial_estimado: r.inicialEstimado,
          compras_detalle: r.comprasDetalle,
          compras_kardex: r.comprasKardex,
          ventas: r.ventasKardex,
          resultado: r.result,
        })),
        null, 2
      ));
      console.log(`📄 Reporte guardado: ${reportPath}\n`);
    } catch {}

    console.log("🔍 Paso final recomendado:");
    console.log("   node scripts/audit-inventory-consistency.mjs\n");

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("\n❌ Error fatal:", err.message);
  process.exit(1);
});
