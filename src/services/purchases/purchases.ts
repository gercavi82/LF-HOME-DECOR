import "server-only";

import { query, execute } from "@/src/lib/db/mysql";
import { requireAnyPermission, requirePermission } from "@/src/services/auth/authorization";
import { purchasePaymentSchema, type PurchasePaymentInput, type PurchasesFilterParams } from "@/src/lib/validation/purchases";
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

    // 3. Query base de compras agrupadas por fecha
    let sql = `
      SELECT 
        MIN(c.id_compra) AS id_compra,
        CONCAT('COM-', DATE_FORMAT(c.fecha, '%Y%m%d')) AS numero_compra,
        DATE(c.fecha) AS fecha,
        SUM(c.subtotal) AS subtotal,
        SUM(c.iva) AS iva,
        SUM(c.total) AS total,
        COALESCE(c.estado, 'REGISTRADA') AS estado,
        GROUP_CONCAT(DISTINCT c.observaciones SEPARATOR '; ') AS observaciones,
        COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor_nombre,
        CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre,
        COALESCE(SUM(dc.cantidad), 1) AS unidades,
        GROUP_CONCAT(DISTINCT CONCAT(prod.descripcion, ' (', dc.cantidad, 'u)') SEPARATOR ', ') AS producto_desc,
        COALESCE(SUM((
          SELECT COALESCE(SUM(pc.monto), 0)
          FROM pagos_compras pc
          WHERE pc.id_compra = c.id_compra AND pc.activo = 1
        )), 0) AS total_abonos
      FROM compras c
      LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
      LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
      LEFT JOIN detalle_compras dc ON dc.id_compra = c.id_compra
      LEFT JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
      LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
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
      whereClauses.push(`prod.id_tipo = ?`);
      params.push(Number(selectedTipoId));
    }

    if (searchQ) {
      whereClauses.push(`(c.numero_compra LIKE ? OR p.nombre LIKE ? OR prod.descripcion LIKE ?)`);
      params.push(`%${searchQ}%`, `%${searchQ}%`, `%${searchQ}%`);
    }

    if (whereClauses.length > 0) {
      sql += ` AND ` + whereClauses.join(" AND ");
    }

    sql += `
      GROUP BY DATE(c.fecha), COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones')
      ORDER BY fecha DESC
      LIMIT 200
    `;

    let rows = await query<PurchaseRowRaw>(sql, params).catch(() => []);

    // Fallback si la subconsulta de pagos_compras falla
    if (!rows || rows.length === 0) {
      const fallbackSql = `
        SELECT 
          MIN(c.id_compra) AS id_compra,
          CONCAT('COM-', DATE_FORMAT(c.fecha, '%Y%m%d')) AS numero_compra,
          DATE(c.fecha) AS fecha,
          SUM(c.subtotal) AS subtotal,
          SUM(c.iva) AS iva,
          SUM(c.total) AS total,
          COALESCE(c.estado, 'REGISTRADA') AS estado,
          GROUP_CONCAT(DISTINCT c.observaciones SEPARATOR '; ') AS observaciones,
          COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor_nombre,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre,
          COALESCE(SUM(dc.cantidad), 1) AS unidades,
          GROUP_CONCAT(DISTINCT CONCAT(prod.descripcion, ' (', dc.cantidad, 'u)') SEPARATOR ', ') AS producto_desc,
          0 AS total_abonos
        FROM compras c
        LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
        LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
        LEFT JOIN detalle_compras dc ON dc.id_compra = c.id_compra
        LEFT JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
        LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
        WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
        GROUP BY DATE(c.fecha), COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones')
        ORDER BY fecha DESC
        LIMIT 200
      `;
      rows = await query<PurchaseRowRaw>(fallbackSql, params).catch(() => []);
    }

    const purchases: PurchaseItem[] = (rows ?? []).map((r) => {
      const total = Number(r.total) || 0;
      const abonos = Number(r.total_abonos) || 0;
      const saldo = Math.max(0, Number((total - abonos).toFixed(2)));

      let estadoPago: "PAGADO" | "ABONO_PARCIAL" | "PENDIENTE" = "PENDIENTE";
      if (saldo <= 0 && total > 0) {
        estadoPago = "PAGADO";
      } else if (abonos > 0) {
        estadoPago = "ABONO_PARCIAL";
      }

      return {
        id_compra: Number(r.id_compra),
        numero_compra: r.numero_compra || `#${r.id_compra}`,
        fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
        proveedor: r.proveedor_nombre ?? "Distribuidora Nacional",
        subtotal: Number(r.subtotal) || 0,
        iva: Number(r.iva) || 0,
        total,
        unidades: Number(r.unidades) || 0,
        producto: r.producto_desc || "Edredones / Sábanas",
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

export async function registerPurchasePayment(input: PurchasePaymentInput) {
  const context = await requirePermission("COMPRA_CREAR");
  const parsed = purchasePaymentSchema.parse(input);

  // Asegurar tabla pagos_compras
  await execute(`
    CREATE TABLE IF NOT EXISTS \`pagos_compras\` (
      \`id_pago_compra\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`id_compra\` BIGINT NOT NULL,
      \`fecha\` DATE NOT NULL,
      \`monto\` DECIMAL(12,2) NOT NULL,
      \`forma_pago\` VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
      \`referencia\` VARCHAR(100) NULL,
      \`observaciones\` TEXT NULL,
      \`registrado_por\` BIGINT NULL,
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_pagos_compras_fecha\` (\`fecha\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `).catch(() => null);

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
