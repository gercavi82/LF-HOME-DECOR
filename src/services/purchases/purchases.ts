import "server-only";

import { query, execute } from "@/src/lib/db/mysql";
import { requireAnyPermission, requirePermission } from "@/src/services/auth/authorization";
import {
  purchasePaymentSchema,
  purchaseCreateSchema,
  type PurchasePaymentInput,
  type PurchaseCreateInput,
  type PurchasesFilterParams,
} from "@/src/lib/validation/purchases";
import { ensureCustomTables } from "@/src/lib/db/ensure-tables";

export type PurchaseItem = {
  id_compra: number;
  numero_compra: string;
  fecha: string;
  proveedor: string;
  subtotal: number;
  iva: number;
  total: number;
  unidades: number;
  producto?: string;
  estado: string;
  observaciones?: string | null;
  usuario?: string;
  total_pagado: number;
  saldo_pendiente: number;
  estado_pago: "PAGADO" | "ABONO_PARCIAL" | "PENDIENTE";
};

export type PurchasesSummary = {
  total: number;
  totalPagado: number;
  totalPendiente: number;
  unidades: number;
  count: number;
  promedio: number;
};

export type PurchasePaymentItem = {
  id_pago_compra: number;
  id_compra: number;
  numero_compra: string;
  proveedor: string;
  fecha: string;
  monto: number;
  forma_pago: string;
  referencia: string | null;
  observaciones: string | null;
  registrador: string;
};

type PurchaseRowRaw = {
  id_compra: number;
  numero_compra: string;
  fecha: Date | string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  observaciones: string | null;
  proveedor_nombre: string | null;
  usuario_nombre: string | null;
  unidades: number;
  producto_desc: string | null;
  total_abonos: number;
};

export async function listPurchases(filters?: PurchasesFilterParams): Promise<{
  purchases: PurchaseItem[];
  summary: PurchasesSummary;
  availableYears: string[];
  availableTypes: Array<{ id: number; nombre: string }>;
}> {
  await requireAnyPermission([
    "COMPRA_VER",
    "INVENTARIO_VER",
    "PRODUCTO_VER",
    "DASHBOARD_VER",
    "VENTA_VER",
  ]);

  await ensureCustomTables().catch(() => null);

  const selectedYear = filters?.year?.trim() || "";
  const selectedMonth = filters?.month?.trim() || "";
  const selectedTipoId = filters?.tipoId?.trim() || "";
  const searchQ = filters?.q?.trim() || "";

  try {
    // 1. Obtener años disponibles de compras
    const yearRows = await query<{ anio: string }>(
      `SELECT DISTINCT DATE_FORMAT(fecha, '%Y') AS anio FROM compras WHERE fecha IS NOT NULL ORDER BY anio DESC`
    ).catch(() => []);
    const availableYears = (yearRows ?? []).map((r) => String(r.anio)).filter(Boolean);
    if (!availableYears.includes("2026")) {
      availableYears.push("2026");
    }

    // 2. Obtener tipos de productos disponibles
    const typeRows = await query<{ id: number; nombre: string }>(
      `SELECT id_tipo AS id, nombre FROM tipos_producto WHERE activo = 1 ORDER BY nombre ASC`
    ).catch(() => []);
    const availableTypes = (typeRows ?? []).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) }));

    // 3. Query base de compras
    let sql = `
      SELECT 
        c.id_compra,
        COALESCE(c.numero_compra, CONCAT('COM-', DATE_FORMAT(c.fecha, '%Y%m%d'), '-', c.id_compra)) AS numero_compra,
        DATE(c.fecha) AS fecha,
        c.subtotal AS subtotal,
        c.iva AS iva,
        c.total AS total,
        COALESCE(c.estado, 'REGISTRADA') AS estado,
        c.observaciones AS observaciones,
        COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor_nombre,
        CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre,
        COALESCE((
          SELECT SUM(dc.cantidad)
          FROM detalle_compras dc
          WHERE dc.id_compra = c.id_compra
        ), 0) AS unidades,
        COALESCE((
          SELECT SUM(pc.monto)
          FROM pagos_compras pc
          WHERE pc.id_compra = c.id_compra AND pc.activo = 1
        ), 0) AS total_abonos
      FROM compras c
      LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
      LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
      WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    `;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (selectedYear) {
      whereClauses.push(`DATE_FORMAT(c.fecha, '%Y') = ?`);
      params.push(selectedYear);
    }

    if (selectedMonth) {
      whereClauses.push(`DATE_FORMAT(c.fecha, '%m') = ?`);
      params.push(selectedMonth.padStart(2, "0"));
    }

    if (selectedTipoId && Number(selectedTipoId) > 0) {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM detalle_compras dc2
        JOIN variantes_producto vp2 ON vp2.id_variante = dc2.id_variante
        JOIN productos prod2 ON prod2.id_producto = vp2.id_producto
        WHERE dc2.id_compra = c.id_compra AND prod2.id_tipo = ?
      )`);
      params.push(Number(selectedTipoId));
    }

    if (searchQ) {
      whereClauses.push(`(
        c.numero_compra LIKE ? OR 
        p.nombre LIKE ? OR 
        EXISTS (
          SELECT 1 FROM detalle_compras dc3
          JOIN variantes_producto vp3 ON vp3.id_variante = dc3.id_variante
          JOIN productos prod3 ON prod3.id_producto = vp3.id_producto
          WHERE dc3.id_compra = c.id_compra AND prod3.descripcion LIKE ?
        )
      )`);
      params.push(`%${searchQ}%`, `%${searchQ}%`, `%${searchQ}%`);
    }

    if (whereClauses.length > 0) {
      sql += ` AND ` + whereClauses.join(" AND ");
    }

    sql += `
      ORDER BY c.fecha DESC, c.id_compra DESC
      LIMIT 200
    `;

    let rows = await query<PurchaseRowRaw>(sql, params).catch(() => []);

    // 4. Query consolidada de productos por compra
    const itemRows = await query<{
      id_compra: number;
      descripcion: string;
      cantidad_total: number;
      precio_unitario: number;
    }>(`
      SELECT 
        dc.id_compra,
        prod.descripcion,
        SUM(dc.cantidad) AS cantidad_total,
        dc.precio_unitario
      FROM detalle_compras dc
      JOIN compras c ON c.id_compra = dc.id_compra
      JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
      JOIN productos prod ON prod.id_producto = vp.id_producto
      WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
      GROUP BY dc.id_compra, prod.descripcion, dc.precio_unitario
      ORDER BY prod.descripcion ASC
    `).catch(() => []);

    const itemsByPurchaseMap = new Map<number, string[]>();
    for (const it of itemRows ?? []) {
      const purchaseId = Number(it.id_compra);
      if (!itemsByPurchaseMap.has(purchaseId)) {
        itemsByPurchaseMap.set(purchaseId, []);
      }
      const unitPriceStr = Number(it.precio_unitario || 0).toFixed(2);
      itemsByPurchaseMap.get(purchaseId)!.push(
        `${it.descripcion} (${it.cantidad_total}u a $${unitPriceStr} c/u)`
      );
    }

    const purchases: PurchaseItem[] = (rows ?? []).map((r) => {
      const total = Number(r.total) || 0;
      const abonos = Number(r.total_abonos) || 0;
      const saldo = Math.max(0, Number((total - abonos).toFixed(2)));
      const dateStr = typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10);
      const purchaseId = Number(r.id_compra);

      const itemsList = itemsByPurchaseMap.get(purchaseId) || [];
      const consolidatedDesc = itemsList.length > 0 ? itemsList.join(" | ") : (r.producto_desc || "Prendas textiles");

      let estadoPago: "PAGADO" | "ABONO_PARCIAL" | "PENDIENTE" = "PENDIENTE";
      if (saldo <= 0 && total > 0) {
        estadoPago = "PAGADO";
      } else if (abonos > 0) {
        estadoPago = "ABONO_PARCIAL";
      }

      return {
        id_compra: Number(r.id_compra),
        numero_compra: r.numero_compra || `#${r.id_compra}`,
        fecha: dateStr,
        proveedor: r.proveedor_nombre ?? "Distribuidora Nacional",
        subtotal: Number(r.subtotal) || 0,
        iva: Number(r.iva) || 0,
        total,
        unidades: Number(r.unidades) || 0,
        producto: consolidatedDesc,
        estado: r.estado,
        observaciones: r.observaciones ?? null,
        usuario: r.usuario_nombre ?? "Administrador",
        total_pagado: abonos,
        saldo_pendiente: saldo,
        estado_pago: estadoPago,
      };
    });

    const total = purchases.reduce((sum, p) => sum + p.total, 0);
    const totalPagado = purchases.reduce((sum, p) => sum + p.total_pagado, 0);
    const totalPendiente = purchases.reduce((sum, p) => sum + p.saldo_pendiente, 0);
    const unidades = purchases.reduce((sum, p) => sum + p.unidades, 0);
    const count = purchases.length;
    const promedio = count > 0 ? Number((total / count).toFixed(2)) : 0;

    return {
      purchases,
      summary: { total, totalPagado, totalPendiente, unidades, count, promedio },
      availableYears,
      availableTypes,
    };
  } catch (error) {
    console.error("listPurchases ERROR:", error);
    return {
      purchases: [],
      summary: { total: 0, totalPagado: 0, totalPendiente: 0, unidades: 0, count: 0, promedio: 0 },
      availableYears: [],
      availableTypes: [],
    };
  }
}

export async function listPurchasePayments(purchaseId?: number): Promise<PurchasePaymentItem[]> {
  await requireAnyPermission(["COMPRA_VER", "INVENTARIO_VER", "FINANZAS_VER", "DASHBOARD_VER"]);

  let sql = `
    SELECT 
      pc.id_pago_compra,
      pc.id_compra,
      c.numero_compra,
      COALESCE(p.nombre, 'Distribuidora Nacional de Blancos') AS proveedor,
      pc.fecha,
      pc.monto,
      pc.forma_pago,
      pc.referencia,
      pc.observaciones,
      CONCAT(u.nombres, ' ', u.apellidos) AS registrador
    FROM pagos_compras pc
    JOIN compras c ON c.id_compra = pc.id_compra
    LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
    LEFT JOIN usuarios u ON u.id_usuario = pc.registrado_por
    WHERE pc.activo = 1
  `;

  const params: unknown[] = [];
  if (purchaseId && purchaseId > 0) {
    sql += ` AND pc.id_compra = ?`;
    params.push(purchaseId);
  }

  sql += ` ORDER BY pc.fecha DESC, pc.id_pago_compra DESC LIMIT 100`;

  try {
    const rows = await query<{
      id_pago_compra: number;
      id_compra: number;
      numero_compra: string;
      proveedor: string;
      fecha: Date | string;
      monto: number;
      forma_pago: string;
      referencia: string | null;
      observaciones: string | null;
      registrador: string | null;
    }>(sql, params).catch(() => []);

    return (rows ?? []).map((r) => ({
      id_pago_compra: Number(r.id_pago_compra),
      id_compra: Number(r.id_compra),
      numero_compra: r.numero_compra,
      proveedor: r.proveedor,
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
      monto: Number(r.monto) || 0,
      forma_pago: r.forma_pago || "Transferencia",
      referencia: r.referencia ?? null,
      observaciones: r.observaciones ?? null,
      registrador: r.registrador || "Administración",
    }));
  } catch (error) {
    console.error("listPurchasePayments ERROR:", error);
    return [];
  }
}

export async function getPurchaseCatalogs(): Promise<{
  proveedores: Array<{ id: number; nombre: string; ruc_cedula: string }>;
  variantes: Array<{ id_variante: number; descripcion: string; codigo_interno: string; precio_venta: number }>;
}> {
  await requireAnyPermission(["COMPRA_VER", "COMPRA_CREAR", "INVENTARIO_VER"]);

  const [proveedores, variantes] = await Promise.all([
    query<{ id_proveedor: number; nombre: string; ruc_cedula: string }>(
      `SELECT id_proveedor, nombre, ruc_cedula FROM proveedores WHERE activo = 1 ORDER BY nombre ASC`
    ).catch(() => []),
    query<{ id_variante: number; descripcion: string; codigo_interno: string; precio_venta: number }>(
      `SELECT vp.id_variante, prod.descripcion, vp.codigo_interno, vp.precio_venta
       FROM variantes_producto vp
       JOIN productos prod ON prod.id_producto = vp.id_producto
       WHERE vp.activo = 1 AND prod.activo = 1
       ORDER BY prod.descripcion ASC`
    ).catch(() => []),
  ]);

  return {
    proveedores: (proveedores ?? []).map((p) => ({
      id: Number(p.id_proveedor),
      nombre: p.nombre,
      ruc_cedula: p.ruc_cedula,
    })),
    variantes: (variantes ?? []).map((v) => ({
      id_variante: Number(v.id_variante),
      descripcion: v.descripcion,
      codigo_interno: v.codigo_interno,
      precio_venta: Number(v.precio_venta) || 0,
    })),
  };
}

export type PurchaseDetailRecord = {
  id_compra: number;
  numero_compra: string;
  id_proveedor: number;
  proveedor: string;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  observaciones: string | null;
  items: Array<{
    id_detalle_compra?: number;
    id_variante: number;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    porcentaje_iva: number;
    subtotal: number;
    iva: number;
    total: number;
  }>;
};

export async function getPurchaseById(id: number): Promise<PurchaseDetailRecord | null> {
  await requireAnyPermission(["COMPRA_VER", "COMPRA_EDITAR", "INVENTARIO_VER"]);

  const [compraRows, itemRows] = await Promise.all([
    query<{
      id_compra: number;
      numero_compra: string;
      id_proveedor: number;
      proveedor_nombre: string;
      fecha: Date | string;
      subtotal: number;
      iva: number;
      total: number;
      observaciones: string | null;
    }>(
      `SELECT 
         c.id_compra, c.numero_compra, c.id_proveedor, 
         COALESCE(p.nombre, 'Distribuidora Nacional de Blancos') AS proveedor_nombre,
         c.fecha, c.subtotal, c.iva, c.total, c.observaciones
       FROM compras c
       LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
       WHERE c.id_compra = ?`,
      [id]
    ).catch(() => []),
    query<{
      id_detalle_compra: number;
      id_variante: number;
      descripcion: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      iva: number;
      total: number;
    }>(
      `SELECT 
         dc.id_detalle_compra, dc.id_variante, prod.descripcion,
         dc.cantidad, dc.precio_unitario, dc.subtotal, dc.iva, dc.total
       FROM detalle_compras dc
       JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
       JOIN productos prod ON prod.id_producto = vp.id_producto
       WHERE dc.id_compra = ?`,
      [id]
    ).catch(() => []),
  ]);

  const compra = compraRows?.[0];
  if (!compra) return null;

  return {
    id_compra: Number(compra.id_compra),
    numero_compra: compra.numero_compra,
    id_proveedor: Number(compra.id_proveedor),
    proveedor: compra.proveedor_nombre,
    fecha: typeof compra.fecha === "string" ? compra.fecha.slice(0, 10) : new Date(compra.fecha).toISOString().slice(0, 10),
    subtotal: Number(compra.subtotal) || 0,
    iva: Number(compra.iva) || 0,
    total: Number(compra.total) || 0,
    observaciones: compra.observaciones ?? null,
    items: (itemRows ?? []).map((it) => {
      const subtotal = Number(it.subtotal) || 0;
      const iva = Number(it.iva) || 0;
      const total = Number(it.total) || 0;
      const pctIva = subtotal > 0 ? Number(((iva / subtotal) * 100).toFixed(0)) : 15;

      return {
        id_detalle_compra: Number(it.id_detalle_compra),
        id_variante: Number(it.id_variante),
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad) || 1,
        precio_unitario: Number(it.precio_unitario) || 0,
        porcentaje_iva: pctIva,
        subtotal,
        iva,
        total,
      };
    }),
  };
}

export async function createPurchase(input: PurchaseCreateInput): Promise<number> {
  const context = await requirePermission("COMPRA_CREAR");
  const parsed = purchaseCreateSchema.parse(input);

  // Calcular subtotales, iva y total
  let totalSubtotal = 0;
  let totalIva = 0;

  const processedItems = parsed.items.map((it) => {
    const itSubtotal = Number((it.cantidad * it.precio_unitario).toFixed(2));
    const itIva = Number((itSubtotal * (it.porcentaje_iva / 100)).toFixed(2));
    const itTotal = Number((itSubtotal + itIva).toFixed(2));

    totalSubtotal += itSubtotal;
    totalIva += itIva;

    return {
      ...it,
      subtotal: itSubtotal,
      iva: itIva,
      total: itTotal,
    };
  });

  totalSubtotal = Number(totalSubtotal.toFixed(2));
  totalIva = Number(totalIva.toFixed(2));
  const totalGeneral = Number((totalSubtotal + totalIva).toFixed(2));

  // Insertar cabecera de compra
  const result = await execute(
    `INSERT INTO compras (id_proveedor, id_local, id_usuario, numero_compra, fecha, subtotal, iva, total, observaciones, estado)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 'REGISTRADA')`,
    [
      parsed.id_proveedor,
      context.id_usuario,
      parsed.numero_compra,
      `${parsed.fecha} 10:00:00`,
      totalSubtotal,
      totalIva,
      totalGeneral,
      parsed.observaciones || null,
    ]
  );

  const idCompra = result.insertId;

  // Insertar cada item en detalle_compras y actualizar stock
  for (const it of processedItems) {
    await execute(
      `INSERT INTO detalle_compras (id_compra, id_variante, cantidad, precio_unitario, subtotal, iva, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idCompra, it.id_variante, it.cantidad, it.precio_unitario, it.subtotal, it.iva, it.total]
    );

    // Incrementar stock en bodega matriz (id_bodega = 1)
    await execute(
      `INSERT INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
       VALUES (?, 1, ?, NOW())
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad), fecha_actualizacion = NOW()`,
      [it.id_variante, it.cantidad]
    ).catch(() => null);

    // Registrar movimiento de entrada
    await execute(
      `INSERT INTO movimientos_inventario (id_bodega, id_variante, id_usuario, tipo_movimiento, cantidad, saldo_anterior, saldo_nuevo, motivo, fecha)
       VALUES (1, ?, ?, 'ENTRADA', ?, 0, ?, ?, NOW())`,
      [it.id_variante, context.id_usuario, it.cantidad, it.cantidad, `Ingreso por compra ${parsed.numero_compra}`]
    ).catch(() => null);
  }

  return idCompra;
}

export async function updatePurchase(id: number, input: PurchaseCreateInput): Promise<void> {
  const context = await requirePermission("COMPRA_EDITAR");
  const parsed = purchaseCreateSchema.parse(input);

  // Obtener items actuales para revertir el stock anterior
  const oldItems = await query<{ id_variante: number; cantidad: number }>(
    `SELECT id_variante, cantidad FROM detalle_compras WHERE id_compra = ?`,
    [id]
  ).catch(() => []);

  for (const oldIt of oldItems ?? []) {
    await execute(
      `UPDATE stock_producto 
       SET cantidad = GREATEST(0, cantidad - ?), fecha_actualizacion = NOW() 
       WHERE id_variante = ? AND id_bodega = 1`,
      [Number(oldIt.cantidad) || 0, oldIt.id_variante]
    ).catch(() => null);
  }

  // Eliminar detalles anteriores
  await execute(`DELETE FROM detalle_compras WHERE id_compra = ?`, [id]);

  // Recalcular y preparar nuevos items
  let totalSubtotal = 0;
  let totalIva = 0;

  const processedItems = parsed.items.map((it) => {
    const itSubtotal = Number((it.cantidad * it.precio_unitario).toFixed(2));
    const itIva = Number((itSubtotal * (it.porcentaje_iva / 100)).toFixed(2));
    const itTotal = Number((itSubtotal + itIva).toFixed(2));

    totalSubtotal += itSubtotal;
    totalIva += itIva;

    return {
      ...it,
      subtotal: itSubtotal,
      iva: itIva,
      total: itTotal,
    };
  });

  totalSubtotal = Number(totalSubtotal.toFixed(2));
  totalIva = Number(totalIva.toFixed(2));
  const totalGeneral = Number((totalSubtotal + totalIva).toFixed(2));

  // Actualizar cabecera de compra
  await execute(
    `UPDATE compras 
     SET id_proveedor = ?, 
         numero_compra = ?, 
         fecha = ?, 
         subtotal = ?, 
         iva = ?, 
         total = ?, 
         observaciones = ?
     WHERE id_compra = ?`,
    [
      parsed.id_proveedor,
      parsed.numero_compra,
      `${parsed.fecha} 10:00:00`,
      totalSubtotal,
      totalIva,
      totalGeneral,
      parsed.observaciones || null,
      id,
    ]
  );

  // Insertar nuevos detalles y aplicar nuevo stock
  for (const it of processedItems) {
    await execute(
      `INSERT INTO detalle_compras (id_compra, id_variante, cantidad, precio_unitario, subtotal, iva, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, it.id_variante, it.cantidad, it.precio_unitario, it.subtotal, it.iva, it.total]
    );

    // Incrementar stock en bodega matriz (id_bodega = 1)
    await execute(
      `INSERT INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
       VALUES (?, 1, ?, NOW())
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad), fecha_actualizacion = NOW()`,
      [it.id_variante, it.cantidad]
    ).catch(() => null);

    // Registrar movimiento de inventario por modificación
    await execute(
      `INSERT INTO movimientos_inventario (id_bodega, id_variante, id_usuario, tipo_movimiento, cantidad, saldo_anterior, saldo_nuevo, motivo, fecha)
       VALUES (1, ?, ?, 'ENTRADA', ?, 0, ?, ?, NOW())`,
      [it.id_variante, context.id_usuario, it.cantidad, it.cantidad, `Ajuste por edición de compra ${parsed.numero_compra}`]
    ).catch(() => null);
  }
}

export async function registerPurchasePayment(input: PurchasePaymentInput) {
  const context = await requirePermission("COMPRA_CREAR");
  const parsed = purchasePaymentSchema.parse(input);

  await ensureCustomTables().catch(() => null);

  return execute(
    `INSERT INTO pagos_compras (id_compra, fecha, monto, forma_pago, referencia, observaciones, registrado_por, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      parsed.id_compra,
      parsed.fecha,
      parsed.monto,
      parsed.forma_pago,
      parsed.referencia || null,
      parsed.observaciones || null,
      context.id_usuario,
    ]
  );
}
