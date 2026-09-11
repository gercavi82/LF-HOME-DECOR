/**
 * ============================================================================
 * RECONSTRUCCIÓN HISTÓRICA DEL KARDEX DE INVENTARIO
 * L&F HOME DECOR / MI HOGAR Y CONFORT
 * ============================================================================
 *
 * OBJETIVO: Reparar movimientos_inventario de forma ADITIVA/RECONSTRUCTIVA
 *   - Insertar movimientos INICIAL faltantes
 *   - Insertar movimientos COMPRA faltantes (compras históricas sin Kardex)
 *   - Recalcular stock_anterior / stock_nuevo en secuencia cronológica
 *   - NUNCA borrar movimientos existentes
 *   - NUNCA tocar stock_producto.cantidad directamente
 *
 * MODOS:
 *   node scripts/rebuild-inventory-kardex.mjs            → dry-run (solo reporte)
 *   node scripts/rebuild-inventory-kardex.mjs --dry-run  → dry-run (solo reporte)
 *   node scripts/rebuild-inventory-kardex.mjs --apply    → aplicar cambios reales
 *
 * ============================================================================
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

// ─── Carga de variables de entorno ──────────────────────────────────────────

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
        break; // Cargar solo el primer archivo encontrado
      }
    } catch {}
  }
}

loadEnv();

// ─── Configuración ──────────────────────────────────────────────────────────

const isDryRun = !process.argv.includes("--apply");
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lf_home_decor",
  waitForConnections: true,
  connectionLimit: 3,
  decimalNumbers: true,
};

// ─── Tipos de movimiento ─────────────────────────────────────────────────────

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

function getMovementFactor(tipo) {
  if (INCOMING_TYPES.has(tipo)) return 1;
  if (OUTGOING_TYPES.has(tipo)) return -1;
  return 0; // Tipo desconocido: no afecta el saldo
}

// ─── Columnas disponibles en movimientos_inventario ─────────────────────────
// La tabla puede no tener columna `usuario` si es número o si es texto.
// Se resuelve dinámicamente para no asumir.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round4(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function formatDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 19).replace("T", " ");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────

async function createBackup(conn) {
  const ts = todayStr();
  const tables = [
    "movimientos_inventario",
    "stock_producto",
    "compras",
    "detalle_compras",
    "ventas",
    "detalle_ventas",
  ];

  console.log("\n📦 FASE 0 — Creando tablas de respaldo...");
  for (const table of tables) {
    const backupName = `backup_${table}_${ts}`;
    try {
      await conn.execute(`CREATE TABLE IF NOT EXISTS \`${backupName}\` LIKE \`${table}\``);
      await conn.execute(`INSERT IGNORE INTO \`${backupName}\` SELECT * FROM \`${table}\``);
      const [[{ total }]] = await conn.execute(`SELECT COUNT(*) AS total FROM \`${backupName}\``);
      console.log(`  ✅ Respaldo creado: ${backupName} (${total} filas)`);
    } catch (err) {
      console.warn(`  ⚠️  No se pudo respaldar ${table}: ${err.message}`);
    }
  }
}

// ─── ANÁLISIS POR VARIANTE/BODEGA ────────────────────────────────────────────

async function analyzeAll(pool) {
  const conn = await pool.getConnection();
  try {
    // 1. Obtener todas las combinaciones variante/bodega en stock_producto
    const [stockRows] = await conn.execute(`
      SELECT 
        sp.id_variante,
        sp.id_bodega,
        sp.id_stock,
        sp.cantidad AS stock_actual,
        p.descripcion AS producto,
        COALESCE(vp.codigo_gs1, vp.codigo_interno, CONCAT('V', sp.id_variante)) AS codigo,
        b.nombre AS bodega,
        b.id_local
      FROM stock_producto sp
      JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
      JOIN productos p ON p.id_producto = vp.id_producto
      JOIN bodegas b ON b.id_bodega = sp.id_bodega
      ORDER BY sp.id_variante, sp.id_bodega
    `);

    // 2. Precarga global de movimientos agrupados por variante/bodega
    const [movRows] = await conn.execute(`
      SELECT 
        id_movimiento, id_variante, id_bodega, tipo, cantidad,
        stock_anterior, stock_nuevo, fecha, referencia_tipo, referencia_id
      FROM movimientos_inventario
      ORDER BY id_variante, id_bodega, fecha ASC, id_movimiento ASC
    `);

    // 3. Precarga de compras activas por variante/bodega
    const [compraRows] = await conn.execute(`
      SELECT 
        c.id_compra,
        c.numero_factura,
        c.fecha AS fecha_compra,
        c.id_local AS local_compra,
        dc.id_variante,
        SUM(dc.cantidad) AS cantidad_total
      FROM detalle_compras dc
      JOIN compras c ON c.id_compra = dc.id_compra
      WHERE c.estado != 'ANULADA'
      GROUP BY c.id_compra, c.numero_factura, c.fecha, c.id_local, dc.id_variante
      ORDER BY c.fecha ASC, c.id_compra ASC
    `);

    // 4. Bodegas activas por local
    const [bodegaRows] = await conn.execute(`
      SELECT id_bodega, id_local, nombre
      FROM bodegas
      WHERE activo = 1
      ORDER BY id_bodega ASC
    `);

    // Construir índices en memoria
    const movsByVarianteBodega = new Map();
    for (const m of movRows) {
      const key = `${m.id_variante}:${m.id_bodega}`;
      if (!movsByVarianteBodega.has(key)) movsByVarianteBodega.set(key, []);
      movsByVarianteBodega.get(key).push(m);
    }

    const bodegaByLocal = new Map();
    for (const b of bodegaRows) {
      if (!bodegaByLocal.has(b.id_local)) bodegaByLocal.set(b.id_local, b.id_bodega);
    }

    // Índice de movimientos COMPRA existentes: key = `compra:variante:bodega`
    const existingCompraMov = new Set();
    for (const m of movRows) {
      if (m.tipo === "COMPRA" && m.referencia_tipo === "COMPRA" && m.referencia_id) {
        existingCompraMov.add(`${m.referencia_id}:${m.id_variante}:${m.id_bodega}`);
      }
    }

    // Índice de movimientos INICIAL existentes: key = `variante:bodega`
    const existingInicial = new Set();
    for (const m of movRows) {
      if (m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL") {
        existingInicial.add(`${m.id_variante}:${m.id_bodega}`);
      }
    }

    // 5. Analizar cada combinación variante/bodega
    const results = [];

    for (const stock of stockRows) {
      const { id_variante, id_bodega, stock_actual, producto, codigo, bodega, id_local } = stock;
      const key = `${id_variante}:${id_bodega}`;

      const movimientosExistentes = movsByVarianteBodega.get(key) || [];

      // Saldo Kardex actual (suma de todos los movimientos existentes)
      let saldoKardexActual = 0;
      for (const m of movimientosExistentes) {
        const factor = getMovementFactor(m.tipo);
        saldoKardexActual = round4(saldoKardexActual + factor * Number(m.cantidad));
      }

      // Compras activas de esta variante (para determinar las faltantes en Kardex)
      const comprasVariante = compraRows.filter(c => Number(c.id_variante) === Number(id_variante));

      // Compras faltantes en Kardex (no tienen movimiento COMPRA correspondiente)
      const comprasFaltantes = [];
      for (const c of comprasVariante) {
        // Determinar bodega de la compra
        const bodegaCompra = bodegaByLocal.get(Number(c.local_compra)) || null;
        if (bodegaCompra === null) {
          comprasFaltantes.push({ ...c, bodega_destino: null, estado: "BODEGA_NO_DETERMINADA" });
          continue;
        }
        // Solo las faltantes para esta bodega específica
        if (bodegaCompra !== Number(id_bodega)) continue;
        const movKey = `${c.id_compra}:${id_variante}:${id_bodega}`;
        if (!existingCompraMov.has(movKey)) {
          comprasFaltantes.push({ ...c, bodega_destino: id_bodega, estado: "FALTANTE" });
        }
      }

      // Otras entradas y salidas ya en Kardex (distintas a INICIAL y COMPRA)
      let otrasEntradas = 0;
      let otrasSalidas = 0;
      for (const m of movimientosExistentes) {
        if (m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL") continue;
        if (m.tipo === "COMPRA") continue;
        if (m.tipo === "VENTA") continue;
        const factor = getMovementFactor(m.tipo);
        if (factor > 0) otrasEntradas = round4(otrasEntradas + Number(m.cantidad));
        else if (factor < 0) otrasSalidas = round4(otrasSalidas + Number(m.cantidad));
      }

      // Ventas en Kardex (ya registradas)
      let totalVentasKardex = 0;
      for (const m of movimientosExistentes) {
        if (m.tipo === "VENTA") totalVentasKardex = round4(totalVentasKardex + Number(m.cantidad));
      }

      // Compras en Kardex (ya registradas)
      let totalComprasKardex = 0;
      for (const m of movimientosExistentes) {
        if (m.tipo === "COMPRA") totalComprasKardex = round4(totalComprasKardex + Number(m.cantidad));
      }

      // Compras faltantes total
      const totalComprasFaltantes = comprasFaltantes
        .filter(c => c.estado === "FALTANTE")
        .reduce((s, c) => round4(s + Number(c.cantidad_total)), 0);

      // Estimar inventario inicial:
      // INICIAL = STOCK_FINAL - COMPRAS_TOTALES + VENTAS_TOTALES - OTRAS_ENTRADAS + OTRAS_SALIDAS
      const totalComprasTodas = round4(totalComprasKardex + totalComprasFaltantes);
      const inicialEstimado = round4(
        Number(stock_actual)
        - totalComprasTodas
        + totalVentasKardex
        - otrasEntradas
        + otrasSalidas
      );

      const tieneInicial = existingInicial.has(key);

      // Saldo que resultará después de reconstrucción
      const saldoKardexReconstruido = round4(
        saldoKardexActual
        + (tieneInicial ? 0 : (inicialEstimado > 0 ? inicialEstimado : 0))
        + totalComprasFaltantes
      );

      const diferenciaFinal = round4(Number(stock_actual) - saldoKardexReconstruido);

      // Determinar estado
      let estado;
      const bodegaNoDetCount = comprasFaltantes.filter(c => c.estado === "BODEGA_NO_DETERMINADA").length;

      if (Math.abs(round4(Number(stock_actual) - saldoKardexActual)) <= 0.0001 && comprasFaltantes.length === 0) {
        estado = "OK";
      } else if (bodegaNoDetCount > 0) {
        estado = "BODEGA_NO_DETERMINADA";
      } else if (inicialEstimado < -0.0001) {
        estado = "REQUIERE_REVISION";
      } else if (Math.abs(diferenciaFinal) > 0.0001) {
        estado = "REQUIERE_REVISION";
      } else if (!tieneInicial && inicialEstimado > 0.0001) {
        estado = comprasFaltantes.length > 0 ? "REQUIERE_INICIAL+COMPRAS" : "REQUIERE_INICIAL";
      } else if (comprasFaltantes.length > 0) {
        estado = "REQUIERE_COMPRAS";
      } else {
        estado = "OK";
      }

      // Primera fecha de evento (para posicionar el INICIAL)
      const fechasMovimientos = movimientosExistentes.map(m => new Date(m.fecha));
      const fechasCompras = comprasVariante.map(c => new Date(c.fecha_compra));
      const todasFechas = [...fechasMovimientos, ...fechasCompras].filter(f => !isNaN(f));
      const primeraFecha = todasFechas.length > 0
        ? new Date(Math.min(...todasFechas.map(f => f.getTime())))
        : new Date("2020-01-01T00:00:00");

      results.push({
        id_variante: Number(id_variante),
        id_bodega: Number(id_bodega),
        id_stock: stock.id_stock,
        id_local: Number(id_local),
        producto,
        codigo,
        bodega,
        stock_actual: Number(stock_actual),
        tieneInicial,
        inicialEstimado,
        totalComprasKardex,
        totalComprasFaltantes,
        comprasFaltantes,
        saldoKardexActual,
        saldoKardexReconstruido,
        diferenciaFinal,
        movimientosExistentes,
        primeraFecha,
        estado,
      });
    }

    return results;
  } finally {
    conn.release();
  }
}

// ─── RECONSTRUCCIÓN DE UNA VARIANTE/BODEGA ───────────────────────────────────

async function reconstructVariante(conn, item, dryRun) {
  const {
    id_variante, id_bodega, producto, bodega, stock_actual,
    tieneInicial, inicialEstimado, comprasFaltantes,
    movimientosExistentes, primeraFecha, estado,
  } = item;

  if (estado === "OK") {
    return { ok: true, message: "Ya consistente, sin cambios." };
  }

  if (estado === "BODEGA_NO_DETERMINADA" || estado === "REQUIERE_REVISION") {
    return { ok: false, skipped: true, message: `Omitido (estado: ${estado})` };
  }

  const actions = [];

  // ── 1. Insertar INICIAL si falta y es positivo ────────────────────────────
  if (!tieneInicial && inicialEstimado > 0.0001) {
    const fechaInicial = new Date(primeraFecha.getTime() - 1000); // 1 segundo antes
    const fechaStr = fechaInicial.toISOString().slice(0, 19).replace("T", " ");

    if (!dryRun) {
      await conn.execute(`
        INSERT INTO movimientos_inventario 
          (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
           motivo, referencia_tipo, referencia_id, usuario, fecha)
        VALUES (?, ?, 'INICIAL', ?, 0, ?, 
                'Reconstrucción histórica de inventario inicial',
                'RECONSTRUCCION', NULL, NULL, ?)
      `, [id_variante, id_bodega, round4(inicialEstimado), round4(inicialEstimado), fechaStr]);
    }
    actions.push(`INICIAL: +${round4(inicialEstimado)} (fecha: ${fechaStr})`);
  }

  // ── 2. Insertar COMPRAs faltantes ─────────────────────────────────────────
  const comprasFaltantesValidas = comprasFaltantes.filter(c => c.estado === "FALTANTE");
  for (const c of comprasFaltantesValidas) {
    const cantTotal = round4(Number(c.cantidad_total));
    const fechaStr = new Date(c.fecha_compra).toISOString().slice(0, 19).replace("T", " ");

    if (!dryRun) {
      await conn.execute(`
        INSERT INTO movimientos_inventario
          (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
           motivo, referencia_tipo, referencia_id, usuario, fecha)
        VALUES (?, ?, 'COMPRA', ?, 0, 0,
                ?, 'COMPRA', ?, NULL, ?)
      `, [
        id_variante,
        c.bodega_destino,
        cantTotal,
        `Compra histórica ${c.numero_factura || c.id_compra}`,
        c.id_compra,
        fechaStr,
      ]);
    }
    actions.push(`COMPRA #${c.id_compra} (${c.numero_factura || "s/n"}): +${cantTotal} (fecha: ${fechaStr})`);
  }

  // ── 3. Recargar todos los movimientos y recalcular secuencia ──────────────
  const [todosMovRows] = await conn.execute(`
    SELECT id_movimiento, tipo, cantidad, fecha
    FROM movimientos_inventario
    WHERE id_variante = ? AND id_bodega = ?
    ORDER BY fecha ASC, id_movimiento ASC
  `, [id_variante, id_bodega]);

  // Recalcular saldo acumulado
  let saldo = 0;
  const actualizaciones = [];
  let errorSaldoNegativo = null;

  for (const m of todosMovRows) {
    const factor = getMovementFactor(m.tipo);
    const cant = round4(Number(m.cantidad));
    const stockAnt = round4(saldo);
    const stockNuevo = round4(saldo + factor * cant);

    if (stockNuevo < -0.0001) {
      errorSaldoNegativo = {
        id_movimiento: m.id_movimiento,
        tipo: m.tipo,
        cantidad: cant,
        stock_anterior: stockAnt,
        stock_nuevo: stockNuevo,
      };
      break;
    }

    const saldoRealizado = Math.abs(stockNuevo) < 0.0001 ? 0 : stockNuevo;
    actualizaciones.push({
      id_movimiento: m.id_movimiento,
      stock_anterior: stockAnt,
      stock_nuevo: saldoRealizado,
    });
    saldo = saldoRealizado;
  }

  if (errorSaldoNegativo) {
    return {
      ok: false,
      error: "ERROR_SALDO_NEGATIVO",
      detail: errorSaldoNegativo,
      message: `Saldo negativo detectado en movimiento #${errorSaldoNegativo.id_movimiento}`,
    };
  }

  // ── 4. Validar saldo final vs stock_producto ──────────────────────────────
  const saldoFinalReconstruido = round4(saldo);
  const diff = round4(Number(stock_actual) - saldoFinalReconstruido);

  if (Math.abs(diff) > 0.0001) {
    return {
      ok: false,
      error: "DIFERENCIA_RESIDUAL",
      message: `Saldo final reconstruido (${saldoFinalReconstruido}) ≠ stock_producto (${stock_actual}). Diferencia: ${diff}`,
      saldoFinalReconstruido,
      diff,
    };
  }

  // ── 5. Aplicar recálculo de stock_anterior/stock_nuevo ───────────────────
  if (!dryRun) {
    for (const upd of actualizaciones) {
      await conn.execute(`
        UPDATE movimientos_inventario
        SET stock_anterior = ?, stock_nuevo = ?
        WHERE id_movimiento = ?
      `, [upd.stock_anterior, upd.stock_nuevo, upd.id_movimiento]);
    }
  }

  actions.push(`Recalculados ${actualizaciones.length} movimientos → saldo final: ${saldoFinalReconstruido}`);

  return {
    ok: true,
    actions,
    saldoFinalReconstruido,
    diff,
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log(" RECONSTRUCCIÓN HISTÓRICA DEL KARDEX — L&F HOME DECOR / MI HOGAR Y CONFORT ");
  console.log(`  MODO: ${isDryRun ? "DRY-RUN (SOLO SIMULACIÓN, NADA SERÁ MODIFICADO)" : "⚠️  APPLY — SE REALIZARÁN CAMBIOS REALES"}`);
  console.log("================================================================================\n");

  if (isDryRun) {
    console.log("ℹ️  Ejecutando en modo DRY-RUN. Para aplicar cambios ejecuta con --apply.\n");
  }

  let pool;
  try {
    pool = mysql.createPool(DB_CONFIG);
    // Test de conexión
    const testConn = await pool.getConnection();
    await testConn.execute("SELECT 1");
    testConn.release();
    console.log(`✅ Conexión a ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port} establecida.\n`);
  } catch (err) {
    console.error("❌ Error de conexión a la base de datos:", err.message);
    console.error("   Verifica que el servidor MySQL esté corriendo y las variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME estén configuradas.");
    process.exit(1);
  }

  try {
    // ── FASE 1: Análisis ─────────────────────────────────────────────────────
    console.log("⏳ FASE 1 — Analizando todas las variantes/bodegas...");
    const results = await analyzeAll(pool);
    console.log(`   Combinaciones analizadas: ${results.length}\n`);

    // ── Resumen del análisis ─────────────────────────────────────────────────
    const byEstado = {};
    for (const r of results) {
      byEstado[r.estado] = (byEstado[r.estado] || 0) + 1;
    }

    console.log(">>> RESUMEN POR ESTADO:");
    for (const [estado, count] of Object.entries(byEstado)) {
      const icon = estado === "OK" ? "✅" : "⚠️ ";
      console.log(`  ${icon} ${estado}: ${count}`);
    }
    console.log("");

    // ── Reporte detallado de no-OK ───────────────────────────────────────────
    const noOk = results.filter(r => r.estado !== "OK");
    if (noOk.length === 0) {
      console.log("✅ ¡Todos los registros están consistentes! No se requiere ninguna acción.\n");
    } else {
      console.log(`📋 DETALLE DE ${noOk.length} REGISTRO(S) QUE REQUIEREN ATENCIÓN:\n`);
      console.table(noOk.map(r => ({
        "Variante": r.id_variante,
        "Bodega": r.id_bodega,
        "Producto": r.producto.slice(0, 30),
        "Stock Actual": r.stock_actual,
        "Inicial Estimado": round4(r.inicialEstimado),
        "Compras Faltantes": r.totalComprasFaltantes,
        "Kardex Actual": r.saldoKardexActual,
        "Kardex Reconstruido": r.saldoKardexReconstruido,
        "Diferencia": r.diferenciaFinal,
        "Estado": r.estado,
      })));
    }

    // ── FASE 2: Aplicación ───────────────────────────────────────────────────
    if (!isDryRun) {
      const answer = await confirm(
        `\n⚠️  ¿Confirmas que deseas aplicar los cambios a la base de datos "${DB_CONFIG.database}"? (escribe "si" para confirmar): `
      );
      if (answer !== "si") {
        console.log("\n🚫 Operación cancelada por el usuario.");
        await pool.end();
        return;
      }

      // Backup
      const backupConn = await pool.getConnection();
      try {
        await createBackup(backupConn);
      } finally {
        backupConn.release();
      }

      console.log("\n⏳ FASE 3 — Reconstruyendo Kardex (en transacciones por variante/bodega)...\n");

      const applyResults = [];
      for (const item of results) {
        if (item.estado === "OK") {
          applyResults.push({ ...item, result: { ok: true, message: "OK - sin cambios" } });
          continue;
        }

        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const result = await reconstructVariante(conn, item, false);
          if (result.ok) {
            await conn.commit();
          } else {
            await conn.rollback();
          }
          applyResults.push({ ...item, result });
        } catch (err) {
          await conn.rollback();
          applyResults.push({ ...item, result: { ok: false, error: "EXCEPCION", message: err.message } });
        } finally {
          conn.release();
        }

        // Log progreso
        const r = applyResults[applyResults.length - 1].result;
        const icon = r.ok ? "✅" : "❌";
        const msg = r.ok
          ? (r.actions ? r.actions.join(" | ") : "OK")
          : r.message;
        console.log(`  ${icon} [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 25)} → ${msg}`);
      }

      // Resumen post-apply
      const okCount = applyResults.filter(r => r.result.ok).length;
      const errCount = applyResults.filter(r => !r.result.ok && !r.result.skipped).length;
      const skipCount = applyResults.filter(r => r.result.skipped).length;

      console.log("\n================================================================================");
      console.log(" RESULTADO FINAL DE LA RECONSTRUCCIÓN");
      console.log("================================================================================");
      console.log(`  ✅ Exitosos:  ${okCount}`);
      console.log(`  ❌ Con error: ${errCount}`);
      console.log(`  ⏭️  Omitidos:  ${skipCount}`);

      if (errCount > 0) {
        console.log("\n⚠️  ERRORES QUE REQUIEREN REVISIÓN MANUAL:");
        for (const r of applyResults.filter(r => !r.result.ok && !r.result.skipped)) {
          console.log(`  [${r.id_variante}:${r.id_bodega}] ${r.producto}: ${r.result.message}`);
        }
      }

      // Exportar reporte JSON
      const reportPath = resolve(process.cwd(), `tmp/kardex_rebuild_report_${todayStr()}.json`);
      try {
        writeFileSync(reportPath, JSON.stringify(
          applyResults.map(r => ({
            id_variante: r.id_variante,
            id_bodega: r.id_bodega,
            producto: r.producto,
            bodega: r.bodega,
            estado_original: r.estado,
            stock_actual: r.stock_actual,
            inicial_estimado: r.inicialEstimado,
            compras_faltantes: r.totalComprasFaltantes,
            kardex_antes: r.saldoKardexActual,
            kardex_despues: r.saldoKardexReconstruido,
            resultado: r.result,
          })),
          null, 2
        ));
        console.log(`\n📄 Reporte guardado en: ${reportPath}`);
      } catch {
        // tmp puede no existir
      }

    } else {
      // Dry-run: simular reconstrucción sin aplicar
      console.log("⏳ FASE 3 (simulación) — Verificando secuencia de reconstrucción...\n");

      let saldoNegCount = 0;
      let revisionCount = 0;
      let bodegaIndeterCount = 0;

      for (const item of noOk) {
        const pool2conn = await pool.getConnection();
        try {
          const simResult = await reconstructVariante(pool2conn, item, true); // dryRun=true
          if (simResult.ok) {
            if (simResult.actions?.length) {
              console.log(`  🔧 [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 25)}`);
              for (const a of simResult.actions) console.log(`       → ${a}`);
            }
          } else if (simResult.skipped) {
            if (item.estado === "REQUIERE_REVISION") revisionCount++;
            if (item.estado === "BODEGA_NO_DETERMINADA") bodegaIndeterCount++;
            console.log(`  ⏭️  [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 25)} OMITIDO: ${simResult.message}`);
          } else if (simResult.error === "ERROR_SALDO_NEGATIVO") {
            saldoNegCount++;
            console.log(`  ❌ [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 25)} ERROR SALDO NEGATIVO: ${simResult.message}`);
          } else {
            console.log(`  ⚠️  [${item.id_variante}:${item.id_bodega}] ${item.producto.slice(0, 25)} → ${simResult.message}`);
          }
        } finally {
          pool2conn.release();
        }
      }

      console.log("\n─────────────────────────────────────────────────────────────────────────────");
      console.log(`  Registros OK (sin cambios):          ${results.filter(r => r.estado === "OK").length}`);
      console.log(`  Requerirían INICIAL:                 ${results.filter(r => r.estado.includes("INICIAL")).length}`);
      console.log(`  Requerirían COMPRAS:                 ${results.filter(r => r.estado.includes("COMPRAS") && !r.estado.includes("INICIAL")).length}`);
      console.log(`  Con ERROR_SALDO_NEGATIVO:            ${saldoNegCount}`);
      console.log(`  REQUIERE_REVISION (manual):          ${revisionCount}`);
      console.log(`  BODEGA_NO_DETERMINADA:               ${bodegaIndeterCount}`);
      console.log("─────────────────────────────────────────────────────────────────────────────");
      console.log("\nℹ️  Para aplicar los cambios ejecuta:");
      console.log("   node scripts/rebuild-inventory-kardex.mjs --apply\n");
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("\n❌ Error fatal en la reconstrucción:", err);
  process.exit(1);
});
