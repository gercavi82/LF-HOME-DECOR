import "server-only";

import { getPool } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

const TOLERANCIA = 0.0001;

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

function getFactor(tipo: string): number {
  if (INCOMING_TYPES.has(tipo)) return 1;
  if (OUTGOING_TYPES.has(tipo)) return -1;
  return 0;
}

function r4(n: number | string | null | undefined): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function nowTs(): string {
  const d = new Date();
  const pad = (n: number, z = 2) => String(n).padStart(z, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type RebuildResult = {
  success: boolean;
  total: number;
  reconciled: number;
  alreadyOk: number;
  skipped: number;
  errors: string[];
  details: {
    id_variante: number;
    id_bodega: number;
    producto: string;
    bodega: string;
    stockActual: number;
    saldoReconstruido: number;
    status: string;
    message?: string;
  }[];
};

export async function rebuildInventoryKardex(options: { dryRun?: boolean } = {}): Promise<RebuildResult> {
  await requirePermission("INVENTARIO_AJUSTAR");
  const dryRun = options.dryRun ?? false;

  const pool = getPool();
  const ts = nowTs();

  // 1. Backups en caso de apply
  if (!dryRun) {
    const connBackup = await pool.getConnection();
    try {
      for (const tbl of ["movimientos_inventario", "stock_producto"]) {
        const backupName = `${tbl}_backup_${ts}`;
        await connBackup.execute(`CREATE TABLE IF NOT EXISTS \`${backupName}\` LIKE \`${tbl}\``);
        await connBackup.execute(`INSERT IGNORE INTO \`${backupName}\` SELECT * FROM \`${tbl}\``);
      }
    } finally {
      connBackup.release();
    }
  }

  // 2. Cargar datos base
  const connBase = await pool.getConnection();
  let stocks: any[] = [];
  let movs: any[] = [];
  let compras: any[] = [];
  let bodegas: any[] = [];

  try {
    const [stocksRes] = await connBase.execute<any[]>(`
      SELECT sp.id_variante, sp.id_bodega, sp.id_stock, sp.cantidad AS stock_actual,
             p.descripcion AS producto, vp.codigo_gs1, vp.codigo_interno,
             b.nombre AS bodega, b.id_local
      FROM stock_producto sp
      JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
      JOIN productos p ON p.id_producto = vp.id_producto
      JOIN bodegas b ON b.id_bodega = sp.id_bodega
      ORDER BY sp.id_variante, sp.id_bodega
    `);
    stocks = stocksRes;

    const [movsRes] = await connBase.execute<any[]>(`
      SELECT id_movimiento, id_variante, id_bodega, tipo, cantidad,
             stock_anterior, stock_nuevo, fecha, referencia_tipo, referencia_id
      FROM movimientos_inventario
      ORDER BY id_variante, id_bodega, fecha ASC, id_movimiento ASC
    `);
    movs = movsRes;

    const [comprasRes] = await connBase.execute<any[]>(`
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
    compras = comprasRes;

    const [bodegasRes] = await connBase.execute<any[]>(`
      SELECT id_bodega, id_local, nombre FROM bodegas
      WHERE activo = 1
      ORDER BY id_local, id_bodega ASC
    `);
    bodegas = bodegasRes;
  } finally {
    connBase.release();
  }

  // 3. Estructuración en memoria
  const movIdx = new Map<string, any[]>();
  for (const m of movs) {
    const k = `${m.id_variante}:${m.id_bodega}`;
    if (!movIdx.has(k)) movIdx.set(k, []);
    movIdx.get(k)!.push(m);
  }

  const bodegasByLocal = new Map<number, number[]>();
  for (const b of bodegas) {
    const li = Number(b.id_local);
    if (!bodegasByLocal.has(li)) bodegasByLocal.set(li, []);
    bodegasByLocal.get(li)!.push(Number(b.id_bodega));
  }

  const compraMovIdx = new Map<string, number>();
  for (const m of movs) {
    if (m.tipo === "COMPRA" && m.referencia_tipo === "COMPRA" && m.referencia_id) {
      const k = `${m.referencia_id}:${m.id_variante}:${m.id_bodega}`;
      compraMovIdx.set(k, r4((compraMovIdx.get(k) || 0) + Number(m.cantidad)));
    }
  }

  const tieneInicialSet = new Set<string>();
  for (const m of movs) {
    if (m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL") {
      tieneInicialSet.add(`${m.id_variante}:${m.id_bodega}`);
    }
  }

  // 4. Procesar y Reconstruir
  let okCount = 0;
  let reconciledCount = 0;
  let skipCount = 0;
  const errors: string[] = [];
  const details: RebuildResult["details"] = [];

  for (const stock of stocks) {
    const idV = Number(stock.id_variante);
    const idB = Number(stock.id_bodega);
    const idL = Number(stock.id_local);
    const stockActual = r4(stock.stock_actual);
    const key = `${idV}:${idB}`;

    const movsVB = movIdx.get(key) || [];

    let comprasKardex = 0;
    let ventasKardex = 0;
    let otrasEntradas = 0;
    let otrasSalidas = 0;

    for (const m of movsVB) {
      const tipo = m.tipo;
      const cant = r4(m.cantidad);
      if (tipo === "INICIAL" || tipo === "ENTRADA_INICIAL") continue;
      if (tipo === "COMPRA") { comprasKardex = r4(comprasKardex + cant); continue; }
      if (tipo === "VENTA") { ventasKardex = r4(ventasKardex + cant); continue; }
      const f = getFactor(tipo);
      if (f > 0) otrasEntradas = r4(otrasEntradas + cant);
      if (f < 0) otrasSalidas = r4(otrasSalidas + cant);
    }

    const comprasVariante = compras.filter((c) => Number(c.id_variante) === idV);
    const bodegasLocal = bodegasByLocal.get(idL) || [];

    let comprasDetalle = 0;
    const comprasFaltantes: any[] = [];
    let hayOverregistro = false;
    let hayBodegaAmbigua = bodegasLocal.length !== 1;

    for (const c of comprasVariante) {
      const localCompra = Number(c.local_compra);
      const bodegasCompra = bodegasByLocal.get(localCompra) || [];

      if (bodegasCompra.length !== 1) {
        hayBodegaAmbigua = true;
        continue;
      }

      const bodegaCompra = bodegasCompra[0];
      if (bodegaCompra !== idB) continue;

      const cantDetalle = r4(c.cantidad_detalle);
      comprasDetalle = r4(comprasDetalle + cantDetalle);

      const movKey = `${c.id_compra}:${idV}:${idB}`;
      const cantKardex = compraMovIdx.get(movKey) || 0;

      if (r4(cantKardex - cantDetalle) > TOLERANCIA) {
        hayOverregistro = true;
      } else if (r4(cantDetalle - cantKardex) > TOLERANCIA) {
        comprasFaltantes.push({
          ...c,
          bodega_destino: idB,
          cantDetalle,
          cantKardex,
          diferencia: r4(cantDetalle - cantKardex),
        });
      }
    }

    // Fórmula fundamental del enunciado
    const inicialEstimado = r4(stockActual - comprasDetalle + ventasKardex - otrasEntradas + otrasSalidas);
    const tieneInicial = tieneInicialSet.has(key);

    // Saldo acumulado actual en Kardex
    const saldoKardexActual = r4(
      (tieneInicial ? (movsVB.find((m) => m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL")
        ? r4(movsVB.filter((m) => m.tipo === "INICIAL" || m.tipo === "ENTRADA_INICIAL").reduce((s, m) => s + Number(m.cantidad), 0))
        : 0) : 0)
      + comprasKardex
      + otrasEntradas
      - ventasKardex
      - otrasSalidas
    );

    const difActual = r4(Math.abs(stockActual - saldoKardexActual));
    if (difActual <= TOLERANCIA && comprasFaltantes.length === 0) {
      okCount++;
      details.push({
        id_variante: idV,
        id_bodega: idB,
        producto: stock.producto,
        bodega: stock.bodega,
        stockActual,
        saldoReconstruido: stockActual,
        status: "OK",
        message: "Kardex consistente previamente",
      });
      continue;
    }

    if (hayBodegaAmbigua || hayOverregistro || inicialEstimado < -TOLERANCIA) {
      skipCount++;
      const reason = hayBodegaAmbigua ? "BODEGA_AMBIGUA" : hayOverregistro ? "SOBREREGISTRO" : "INICIAL_NEGATIVO";
      errors.push(`[${stock.producto}] Omitido por ${reason}`);
      details.push({
        id_variante: idV,
        id_bodega: idB,
        producto: stock.producto,
        bodega: stock.bodega,
        stockActual,
        saldoReconstruido: saldoKardexActual,
        status: "REQUIERE_REVISION",
        message: `Omitido: ${reason}`,
      });
      continue;
    }

    // Primera fecha de eventos para colocar el INICIAL antes
    const fechas = [
      ...movsVB.map((m) => new Date(m.fecha).getTime()),
      ...comprasVariante.map((c) => new Date(c.fecha_compra).getTime()),
    ].filter((t) => !isNaN(t));
    const primeraFecha = fechas.length > 0 ? new Date(Math.min(...fechas)) : new Date("2020-01-01T00:00:00");

    // Ejecución transaccional por variante/bodega
    const connVar = await pool.getConnection();
    try {
      if (!dryRun) await connVar.beginTransaction();

      // 1. Insertar INICIAL si no existe y es > 0
      if (!tieneInicial && inicialEstimado > TOLERANCIA) {
        const fechaInicial = new Date(primeraFecha.getTime() - 1000);
        const fechaStr = fechaInicial.toISOString().slice(0, 19).replace("T", " ");

        if (!dryRun) {
          await connVar.execute(`
            INSERT INTO movimientos_inventario
              (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
               motivo, referencia_tipo, referencia_id, usuario, fecha)
            VALUES (?, ?, 'INICIAL', ?, 0, ?,
                    'Reconstrucción histórica de inventario inicial',
                    'RECONSTRUCCION_INICIAL', NULL, 'SISTEMA', ?)
          `, [idV, idB, r4(inicialEstimado), r4(inicialEstimado), fechaStr]);
        }
      }

      // 2. Insertar COMPRAs faltantes
      for (const c of comprasFaltantes) {
        const cantInsertar = r4(c.diferencia);
        const fechaStr = new Date(c.fecha_compra).toISOString().slice(0, 19).replace("T", " ");

        if (!dryRun) {
          const [[{ total_kardex }]] = await connVar.execute<any[]>(`
            SELECT COALESCE(SUM(cantidad), 0) AS total_kardex
            FROM movimientos_inventario
            WHERE id_variante = ? AND id_bodega = ?
              AND tipo = 'COMPRA' AND referencia_tipo = 'COMPRA' AND referencia_id = ?
          `, [idV, idB, c.id_compra]);

          const yaRegistrado = r4(Number(total_kardex));
          const necesario = r4(c.cantDetalle - yaRegistrado);

          if (necesario > TOLERANCIA) {
            await connVar.execute(`
              INSERT INTO movimientos_inventario
                (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo,
                 motivo, referencia_tipo, referencia_id, usuario, fecha)
              VALUES (?, ?, 'COMPRA', ?, 0, 0,
                      ?, 'COMPRA', ?, 'SISTEMA', ?)
            `, [
              idV,
              c.bodega_destino,
              necesario,
              `Compra histórica ${c.numero_compra || c.id_compra}`,
              c.id_compra,
              fechaStr,
            ]);
          }
        }
      }

      // 3. Recalcular secuencia y verificar saldos
      const [todosMovs] = await connVar.execute<any[]>(`
        SELECT id_movimiento, tipo, cantidad, fecha
        FROM movimientos_inventario
        WHERE id_variante = ? AND id_bodega = ?
        ORDER BY fecha ASC, id_movimiento ASC
      `, [idV, idB]);

      let saldo = 0;
      const updates: { id_movimiento: number; stockAnt: number; stockNvo: number }[] = [];
      let saldoNegativo = false;

      for (const m of todosMovs) {
        const factor = getFactor(m.tipo);
        const cant = r4(m.cantidad);
        const stockAnt = r4(saldo);
        const stockNvo = r4(saldo + factor * cant);

        if (stockNvo < -TOLERANCIA) {
          saldoNegativo = true;
          break;
        }

        const stockNvoFinal = Math.abs(stockNvo) < TOLERANCIA ? 0 : stockNvo;
        updates.push({ id_movimiento: m.id_movimiento, stockAnt, stockNvo: stockNvoFinal });
        saldo = stockNvoFinal;
      }

      if (saldoNegativo) {
        if (!dryRun) await connVar.rollback();
        errors.push(`[${stock.producto}] Saldo negativo en la secuencia temporal.`);
        skipCount++;
        details.push({
          id_variante: idV,
          id_bodega: idB,
          producto: stock.producto,
          bodega: stock.bodega,
          stockActual,
          saldoReconstruido: saldo,
          status: "ERROR_SALDO_NEGATIVO",
        });
        continue;
      }

      const diffFinal = r4(Math.abs(stockActual - saldo));
      if (diffFinal > TOLERANCIA) {
        if (!dryRun) await connVar.rollback();
        errors.push(`[${stock.producto}] Descuadre final: Reconstruido ${saldo} vs Stock actual ${stockActual}`);
        skipCount++;
        details.push({
          id_variante: idV,
          id_bodega: idB,
          producto: stock.producto,
          bodega: stock.bodega,
          stockActual,
          saldoReconstruido: saldo,
          status: "DIFERENCIA_FINAL",
        });
        continue;
      }

      // 4. Aplicar los valores de stock_anterior / stock_nuevo recalculados
      if (!dryRun) {
        for (const u of updates) {
          await connVar.execute(`
            UPDATE movimientos_inventario
            SET stock_anterior = ?, stock_nuevo = ?
            WHERE id_movimiento = ?
          `, [u.stockAnt, u.stockNvo, u.id_movimiento]);
        }
        await connVar.commit();
      }

      reconciledCount++;
      details.push({
        id_variante: idV,
        id_bodega: idB,
        producto: stock.producto,
        bodega: stock.bodega,
        stockActual,
        saldoReconstruido: saldo,
        status: "RECONCILIADO",
        message: `Reconciliado: Inicial +${inicialEstimado}, Compras insertadas: ${comprasFaltantes.length}`,
      });
    } catch (err: any) {
      if (!dryRun) await connVar.rollback();
      errors.push(`[${stock.producto}] Excepción: ${err.message}`);
      skipCount++;
    } finally {
      connVar.release();
    }
  }

  return {
    success: errors.length === 0,
    total: stocks.length,
    reconciled: reconciledCount,
    alreadyOk: okCount,
    skipped: skipCount,
    errors,
    details,
  };
}
