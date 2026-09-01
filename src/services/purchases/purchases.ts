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
import {
  reconcileSupplierPayments,
  getSupplierAvailableDeposit,
} from "@/src/services/purchases/reconcile-supplier-payments";

export type PurchaseItem = {
  id_compra: number;
  id_proveedor: number;
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
  estado_pago: "PAGADA" | "ABONO_PARCIAL" | "PENDIENTE";
};

export type PurchasesSummary = {
  total: number;
  totalPagado: number; // Total depósitos registrados
  totalAplicado: number; // Total aplicado a facturas
  depositosDisponibles: number; // Saldo de depósito sin aplicar
  totalPendiente: number; // Saldo pendiente de compras
  unidades: number;
  count: number;
  promedio: number;
};

export type PurchasePaymentItem = {
  id_pago_compra: number;
  id_proveedor: number;
  id_compra: number | null;
  numero_compra: string;
  proveedor: string;
  fecha: string;
  monto: number;
  monto_aplicado: number;
  saldo_disponible: number;
  forma_pago: string;
  referencia: string | null;
  observaciones: string | null;
  registrador: string;
};

export type PurchasePaymentApplication = {
  id_aplicacion: number;
  id_pago_compra: number;
  fecha_aplicacion: string;
  fecha_pago: string;
  monto_aplicado: number;
  forma_pago: string;
  referencia: string | null;
  observaciones: string | null;
  registrador: string;
};

type PurchaseRowRaw = {
  id_compra: number;
  id_proveedor: number;
  numero_compra: string;
  fecha: Date | string;
  subtotal: number;
  iva: number;
  total: number;
  total_abonado: number;
  saldo_pendiente: number;
  estado_pago: string;
  estado: string;
  observaciones: string | null;
  proveedor_nombre: string | null;
  usuario_nombre: string | null;
  unidades: number;
  producto_desc: string | null;
};

export async function listPurchases(filters?: PurchasesFilterParams): Promise<{
  purchases: PurchaseItem[];
  summary: PurchasesSummary;
  availableYears: string[];
  availableTypes: Array<{ id: number; nombre: string }>;
}> {
  await requireAnyPermission(["COMPRA_VER", "FINANZAS_VER"]);
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

    // 3. Query base de compras leyendo directamente las columnas de liquidación
    let sql = `
      SELECT 
        c.id_compra,
        c.id_proveedor,
        COALESCE(c.numero_compra, CONCAT('COM-', DATE_FORMAT(c.fecha, '%Y%m%d'), '-', c.id_compra)) AS numero_compra,
        DATE(c.fecha) AS fecha,
        c.subtotal AS subtotal,
        c.iva AS iva,
        c.total AS total,
        COALESCE(c.total_abonado, 0) AS total_abonado,
        COALESCE(c.saldo_pendiente, c.total) AS saldo_pendiente,
        COALESCE(c.estado_pago, 'PENDIENTE') AS estado_pago,
        COALESCE(c.estado, 'REGISTRADA') AS estado,
        c.observaciones AS observaciones,
        COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor_nombre,
        CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre,
        COALESCE((
          SELECT SUM(dc.cantidad)
          FROM detalle_compras dc
          WHERE dc.id_compra = c.id_compra
        ), 0) AS unidades
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
      const abonos = Number(r.total_abonado) || 0;
      const saldo = Number(r.saldo_pendiente) || Math.max(0, Number((total - abonos).toFixed(2)));
      const dateStr = typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10);
      const purchaseId = Number(r.id_compra);

      const itemsList = itemsByPurchaseMap.get(purchaseId) || [];
      const consolidatedDesc = itemsList.length > 0 ? itemsList.join(" | ") : (r.producto_desc || "Prendas textiles");

      let estadoPago: "PAGADA" | "ABONO_PARCIAL" | "PENDIENTE" = "PENDIENTE";
      if (r.estado_pago === "PAGADA" || (saldo <= 0.005 && total > 0)) {
        estadoPago = "PAGADA";
      } else if (abonos > 0) {
        estadoPago = "ABONO_PARCIAL";
      }

      return {
        id_compra: Number(r.id_compra),
        id_proveedor: Number(r.id_proveedor || 1),
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

    // 5. Totales consolidados de compras y depósitos de proveedores
    const depositSummaryRows = await query<{
      total_depositos: number;
      total_aplicado: number;
      total_disponible: number;
    }>(
      `SELECT 
         COALESCE(SUM(monto), 0) AS total_depositos,
         COALESCE(SUM(monto_aplicado), 0) AS total_aplicado,
         COALESCE(SUM(saldo_disponible), 0) AS total_disponible
       FROM pagos_compras 
       WHERE activo = 1`
    ).catch(() => []);

    const totalPagado = Number(depositSummaryRows?.[0]?.total_depositos || 0);
    const totalAplicado = Number(depositSummaryRows?.[0]?.total_aplicado || 0);
    const depositosDisponibles = Number(depositSummaryRows?.[0]?.total_disponible || 0);

    const total = Number(purchases.reduce((sum, p) => sum + p.total, 0).toFixed(2));
    const totalPendiente = Number(purchases.reduce((sum, p) => sum + p.saldo_pendiente, 0).toFixed(2));
    const unidades = purchases.reduce((sum, p) => sum + p.unidades, 0);
    const count = purchases.length;
    const promedio = count > 0 ? Number((total / count).toFixed(2)) : 0;

    return {
      purchases,
      summary: { total, totalPagado, totalAplicado, depositosDisponibles, totalPendiente, unidades, count, promedio },
      availableYears,
      availableTypes,
    };
  } catch (error) {
    console.error("listPurchases ERROR:", error);
    return {
      purchases: [],
      summary: { total: 0, totalPagado: 0, totalAplicado: 0, depositosDisponibles: 0, totalPendiente: 0, unidades: 0, count: 0, promedio: 0 },
      availableYears: [],
      availableTypes: [],
    };
  }
}

export async function listPurchasePayments(purchaseId?: number, supplierId?: number): Promise<PurchasePaymentItem[]> {
  await requireAnyPermission(["COMPRA_VER", "INVENTARIO_VER", "FINANZAS_VER", "DASHBOARD_VER"]);

  let sql = `
    SELECT 
      pc.id_pago_compra,
      COALESCE(pc.id_proveedor, c.id_proveedor, 1) AS id_proveedor,
      pc.id_compra,
      COALESCE(c.numero_compra, 'Depósito General') AS numero_compra,
      COALESCE(pc.proveedor, p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor,
      pc.fecha,
      pc.monto,
      COALESCE(pc.monto_aplicado, 0) AS monto_aplicado,
      COALESCE(pc.saldo_disponible, pc.monto) AS saldo_disponible,
      pc.forma_pago,
      pc.referencia,
      pc.observaciones,
      CONCAT(u.nombres, ' ', u.apellidos) AS registrador
    FROM pagos_compras pc
    LEFT JOIN compras c ON c.id_compra = pc.id_compra
    LEFT JOIN proveedores p ON p.id_proveedor = COALESCE(pc.id_proveedor, c.id_proveedor)
    LEFT JOIN usuarios u ON u.id_usuario = pc.registrado_por
    WHERE pc.activo = 1
  `;

  const params: unknown[] = [];
  if (purchaseId && purchaseId > 0) {
    sql += ` AND pc.id_compra = ?`;
    params.push(purchaseId);
  } else if (supplierId && supplierId > 0) {
    sql += ` AND (pc.id_proveedor = ? OR c.id_proveedor = ?)`;
    params.push(supplierId, supplierId);
  }

  sql += ` ORDER BY pc.fecha DESC, pc.id_pago_compra DESC LIMIT 100`;

  try {
    const rows = await query<{
      id_pago_compra: number;
      id_proveedor: number;
      id_compra: number | null;
      numero_compra: string;
      proveedor: string;
      fecha: Date | string;
      monto: number;
      monto_aplicado: number;
      saldo_disponible: number;
      forma_pago: string;
      referencia: string | null;
      observaciones: string | null;
      registrador: string | null;
    }>(sql, params).catch(() => []);

    return (rows ?? []).map((r) => ({
      id_pago_compra: Number(r.id_pago_compra),
      id_proveedor: Number(r.id_proveedor || 1),
      id_compra: r.id_compra ? Number(r.id_compra) : null,
      numero_compra: r.numero_compra || "Depósito a Proveedor",
      proveedor: r.proveedor,
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
      monto: Number(r.monto) || 0,
      monto_aplicado: Number(r.monto_aplicado) || 0,
      saldo_disponible: Number(r.saldo_disponible) || 0,
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
  proveedores: Array<{ id: number; nombre: string; ruc_cedula: string; saldo_disponible: number }>;
  variantes: Array<{ id_variante: number; descripcion: string; codigo_interno: string; precio_venta: number }>;
}> {
  await requireAnyPermission(["COMPRA_VER", "COMPRA_CREAR", "INVENTARIO_VER"]);

  const [proveedores, variantes] = await Promise.all([
    query<{ id_proveedor: number; nombre: string; ruc_cedula: string; saldo_disponible: number }>(
      `SELECT 
         p.id_proveedor, 
         p.nombre, 
         p.ruc_cedula,
         COALESCE((SELECT SUM(saldo_disponible) FROM pagos_compras pc WHERE pc.id_proveedor = p.id_proveedor AND pc.activo = 1), 0) AS saldo_disponible
       FROM proveedores p 
       WHERE p.activo = 1 
       ORDER BY p.nombre ASC`
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
      saldo_disponible: Number(p.saldo_disponible) || 0,
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
  total_abonado: number;
  saldo_pendiente: number;
  estado_pago: "PAGADA" | "ABONO_PARCIAL" | "PENDIENTE";
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
  abonos_aplicados: PurchasePaymentApplication[];
};

export async function getPurchaseById(id: number): Promise<PurchaseDetailRecord | null> {
  await requireAnyPermission(["COMPRA_VER", "COMPRA_EDITAR", "INVENTARIO_VER"]);

  const [compraRows, itemRows, abonosRows] = await Promise.all([
    query<{
      id_compra: number;
      numero_compra: string;
      id_proveedor: number;
      proveedor_nombre: string;
      fecha: Date | string;
      subtotal: number;
      iva: number;
      total: number;
      total_abonado: number;
      saldo_pendiente: number;
      estado_pago: string;
      observaciones: string | null;
    }>(
      `SELECT 
         c.id_compra, c.numero_compra, c.id_proveedor, 
         COALESCE(p.nombre, 'Distribuidora Nacional de Blancos') AS proveedor_nombre,
         c.fecha, c.subtotal, c.iva, c.total,
         COALESCE(c.total_abonado, 0) AS total_abonado,
         COALESCE(c.saldo_pendiente, c.total) AS saldo_pendiente,
         COALESCE(c.estado_pago, 'PENDIENTE') AS estado_pago,
         c.observaciones
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
    query<{
      id_aplicacion: number;
      id_pago_cuenta: number;
      fecha_aplicacion: Date | string;
      fecha_pago: Date | string;
      monto_aplicado: number;
      forma_pago: string;
      referencia: string | null;
      observaciones: string | null;
      registrador: string | null;
    }>(
      `SELECT 
         apa.id_aplicacion,
         apa.id_pago_cuenta,
         apa.fecha_aplicacion,
         pc.fecha AS fecha_pago,
         apa.monto_aplicado,
         pc.forma_pago,
         pc.referencia,
         pc.observaciones,
         CONCAT(u.nombres, ' ', u.apellidos) AS registrador
       FROM aplicaciones_abonos_proveedor apa
       JOIN pagos_compras pc ON pc.id_pago_compra = apa.id_pago_cuenta
       LEFT JOIN usuarios u ON u.id_usuario = apa.creado_por
       WHERE apa.id_compra = ? AND apa.activo = 1
       ORDER BY pc.fecha ASC, apa.id_aplicacion ASC`,
      [id]
    ).catch(() => []),
  ]);

  const compra = compraRows?.[0];
  if (!compra) return null;

  const total = Number(compra.total) || 0;
  const totalAbonado = Number(compra.total_abonado) || 0;
  const saldoPendiente = Number(compra.saldo_pendiente) || Math.max(0, Number((total - totalAbonado).toFixed(2)));

  let estadoPago: "PAGADA" | "ABONO_PARCIAL" | "PENDIENTE" = "PENDIENTE";
  if (compra.estado_pago === "PAGADA" || (saldoPendiente <= 0.005 && total > 0)) {
    estadoPago = "PAGADA";
  } else if (totalAbonado > 0) {
    estadoPago = "ABONO_PARCIAL";
  }

  return {
    id_compra: Number(compra.id_compra),
    numero_compra: compra.numero_compra,
    id_proveedor: Number(compra.id_proveedor),
    proveedor: compra.proveedor_nombre,
    fecha: typeof compra.fecha === "string" ? compra.fecha.slice(0, 10) : new Date(compra.fecha).toISOString().slice(0, 10),
    subtotal: Number(compra.subtotal) || 0,
    iva: Number(compra.iva) || 0,
    total,
    total_abonado: totalAbonado,
    saldo_pendiente: saldoPendiente,
    estado_pago: estadoPago,
    observaciones: compra.observaciones ?? null,
    items: (itemRows ?? []).map((it) => {
      const subtotal = Number(it.subtotal) || 0;
      const iva = Number(it.iva) || 0;
      const itTotal = Number(it.total) || 0;
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
        total: itTotal,
      };
    }),
    abonos_aplicados: (abonosRows ?? []).map((ab) => ({
      id_aplicacion: Number(ab.id_aplicacion),
      id_pago_compra: Number(ab.id_pago_cuenta),
      fecha_aplicacion: typeof ab.fecha_aplicacion === "string" ? ab.fecha_aplicacion.slice(0, 19) : new Date(ab.fecha_aplicacion).toISOString().slice(0, 19),
      fecha_pago: typeof ab.fecha_pago === "string" ? ab.fecha_pago.slice(0, 10) : new Date(ab.fecha_pago).toISOString().slice(0, 10),
      monto_aplicado: Number(ab.monto_aplicado) || 0,
      forma_pago: ab.forma_pago || "Transferencia",
      referencia: ab.referencia ?? null,
      observaciones: ab.observaciones ?? null,
      registrador: ab.registrador || "Administración",
    })),
  };
}

export async function createPurchase(input: PurchaseCreateInput): Promise<{ idCompra: number; autoAbonoAplicado: number }> {
  const context = await requirePermission("COMPRA_CREAR");
  const parsed = purchaseCreateSchema.parse(input);

  // Verificar depósito disponible previo del proveedor
  const availableBefore = await getSupplierAvailableDeposit(parsed.id_proveedor);

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
    `INSERT INTO compras (id_proveedor, id_local, id_usuario, numero_compra, fecha, subtotal, iva, total, saldo_pendiente, observaciones, estado, estado_pago)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTRADA', 'PENDIENTE')`,
    [
      parsed.id_proveedor,
      context.id_usuario,
      parsed.numero_compra,
      `${parsed.fecha} 10:00:00`,
      totalSubtotal,
      totalIva,
      totalGeneral,
      totalGeneral,
      parsed.observaciones || null,
    ]
  );

  const idCompra = Number(result.insertId);

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

  // Ejecutar conciliación automática FIFO del proveedor
  await reconcileSupplierPayments(parsed.id_proveedor, context.id_usuario);

  // Calcular abono automático aplicado a esta nueva compra
  const autoAbonoAplicado = Math.min(availableBefore, totalGeneral);

  return { idCompra, autoAbonoAplicado };
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

  // Reconciliar compras del proveedor
  await reconcileSupplierPayments(parsed.id_proveedor, context.id_usuario);
}

export async function registerPurchasePayment(input: PurchasePaymentInput) {
  const context = await requirePermission("COMPRA_CREAR");
  const parsed = purchasePaymentSchema.parse(input);

  await ensureCustomTables().catch(() => null);

  const purchaseId = parsed.id_compra && Number(parsed.id_compra) > 0 ? Number(parsed.id_compra) : null;
  let idProveedor = parsed.id_proveedor ? Number(parsed.id_proveedor) : null;

  // Si no viene id_proveedor pero viene id_compra, buscar el proveedor de la compra
  if (!idProveedor && purchaseId) {
    const pRow = await query<{ id_proveedor: number; proveedor_nombre: string }>(
      `SELECT c.id_proveedor, COALESCE(p.nombre, 'Distribuidora') AS proveedor_nombre 
       FROM compras c 
       LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor 
       WHERE c.id_compra = ? LIMIT 1`,
      [purchaseId]
    );
    if (pRow?.[0]?.id_proveedor) {
      idProveedor = Number(pRow[0].id_proveedor);
    }
  }

  if (!idProveedor || idProveedor <= 0) {
    idProveedor = 1; // Proveedor Matriz por defecto
  }

  const provRow = await query<{ nombre: string }>(
    `SELECT nombre FROM proveedores WHERE id_proveedor = ? LIMIT 1`,
    [idProveedor]
  );
  const proveedorNombre = provRow?.[0]?.nombre || parsed.proveedor?.trim() || "Distribuidora Nacional de Blancos & Edredones";

  // 1. Insertar depósito del proveedor
  const result = await execute(
    `INSERT INTO pagos_compras (
       id_proveedor, id_compra, proveedor, fecha, monto, monto_aplicado, saldo_disponible, forma_pago, referencia, observaciones, registrado_por, activo
     ) VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, 1)`,
    [
      idProveedor,
      purchaseId,
      proveedorNombre,
      parsed.fecha,
      parsed.monto,
      parsed.monto,
      parsed.forma_pago,
      parsed.referencia || null,
      parsed.observaciones || null,
      context.id_usuario,
    ]
  );

  // 2. Ejecutar conciliación automática FIFO en compras del proveedor
  const reconciliation = await reconcileSupplierPayments(idProveedor, context.id_usuario);

  return {
    id_pago_compra: Number(result.insertId),
    reconciliation,
  };
}
