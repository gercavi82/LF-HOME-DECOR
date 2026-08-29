import "server-only";

import { z } from "zod";
import { query, queryOne, execute } from "@/src/lib/db/mysql";
import {
  type AuthContext,
  requirePermission,
  requireAnyPermission,
  ROLE_NAMES,
} from "@/src/services/auth/authorization";
import { ensureCustomTables } from "@/src/lib/db/ensure-tables";

export type SaleListItem = {
  id_venta: number;
  numero_venta: string;
  fecha: string;
  local: string;
  cliente: string;
  canal: string;
  vendedor: string;
  total: number;
  utilidad: number;
  comision_asesor: number; // 60%
  comision_local: number;  // 40%
  unidades: number;
  observaciones?: string | null;
  estado: string;
};

export type SalesFilterParams = {
  q?: string;
  asesorId?: string;
  localId?: string;
  mes?: string;
};

export type SalesSummary = {
  totalVentas: number;
  totalUtilidad: number;
  totalComisionAsesor: number;
  totalComisionLocal: number;
  totalGastos: number;
  saldoComisionLocal: number;
  totalUnidades: number;
};

export type SaleReceiptItem = {
  id_detalle: number;
  producto: string;
  descripcion: string;
  codigo_gs1: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  iva: number;
  total: number;
};

export type SaleReceiptPayment = {
  id_pago: number;
  forma: string;
  forma_pago: string;
  valor: number;
  referencia: string | null;
};

export type SaleReceipt = {
  id_venta: number;
  numero_venta: string;
  fecha: string;
  local: string;
  cliente: string;
  identificacion: string | null;
  canal: string;
  vendedor: string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  estado: string;
  items: SaleReceiptItem[];
  pagos: SaleReceiptPayment[];
};

export type SaleHistoryItem = SaleListItem & {
  paymentMethods: string;
};

export type SaleAuditEntry = {
  id: number;
  action: string;
  table: string;
  date: string;
  user: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
};

export type SaleLocation = { id_local: number; nombre: string };
export type SaleProduct = {
  id_variante: number;
  id_producto: number;
  codigo_gs1: string;
  codigo_interno: string;
  precio: number;
  precio_venta: number;
  porcentaje_iva: number;
  stock_minimo: number;
  producto: string;
  id_categoria: number;
  id_tipo: number;
  stockPorLocal: Record<number, number>;
};
export type SaleWarehouse = { id_bodega: number; id_local: number; nombre: string };
export type SaleStock = { id_variante: number; id_bodega: number; cantidad: number };
export type SaleChannel = { id_canal: number; nombre: string; codigo: string };
export type SalePaymentMethod = {
  id_forma_pago: number;
  nombre: string;
  codigo: string;
  requiere_referencia: boolean;
};
export type SaleCustomer = { id_cliente: number; identificacion: string; nombre: string; name: string };

const validDate = /^\d{4}-\d{2}-\d{2}$/;

function cleanSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

type SaleListRowRaw = {
  id_venta: number;
  numero_venta: string | null;
  fecha: Date | string;
  local_nombre: string | null;
  cliente_nombre: string | null;
  canal_nombre: string | null;
  vendedor_nombre: string | null;
  total: number;
  estado: string;
  observaciones: string | null;
  unidades: number;
};

export async function listSales(filtersInput?: string | SalesFilterParams): Promise<{
  sales: SaleListItem[];
  summary: SalesSummary;
  advisors: Array<{ id: number; nombre: string }>;
  locales: Array<{ id: number; nombre: string }>;
  count: number;
  context: AuthContext;
}> {
  const context = await requirePermission("VENTA_VER");

  const filterParams: SalesFilterParams =
    typeof filtersInput === "string" ? { q: filtersInput } : filtersInput || {};

  const normalized = filterParams.q ? cleanSearch(filterParams.q) : "";
  const selectedAsesorId = filterParams.asesorId ? Number(filterParams.asesorId) : null;
  const selectedLocalId = filterParams.localId ? Number(filterParams.localId) : null;
  const selectedMes = filterParams.mes?.trim() || "";

  let sql = `
    SELECT 
      v.id_venta,
      v.numero_venta,
      v.fecha,
      l.nombre AS local_nombre,
      COALESCE(c.razon_social, c.nombres, c.identificacion, 'Consumidor final') AS cliente_nombre,
      ch.nombre AS canal_nombre,
      CONCAT(u.nombres, ' ', u.apellidos) AS vendedor_nombre,
      v.total,
      v.observaciones,
      v.estado,
      COALESCE(SUM(d.cantidad), 1) AS unidades
    FROM ventas v
    JOIN locales l ON l.id_local = v.id_local
    LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
    JOIN canales_venta ch ON ch.id_canal = v.id_canal
    JOIN usuarios u ON u.id_usuario = v.id_usuario
    LEFT JOIN detalle_ventas d ON d.id_venta = v.id_venta
  `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) {
    whereClauses.push(`v.id_local = ?`);
    params.push(context.id_local);
  } else if (selectedLocalId && selectedLocalId > 0) {
    whereClauses.push(`v.id_local = ?`);
    params.push(selectedLocalId);
  }

  if (context.perfil === ROLE_NAMES.ASESOR) {
    whereClauses.push(`v.id_usuario = ?`);
    params.push(context.id_usuario);
  } else if (selectedAsesorId && selectedAsesorId > 0) {
    whereClauses.push(`v.id_usuario = ?`);
    params.push(selectedAsesorId);
  }

  if (selectedMes && /^\d{4}-\d{2}$/.test(selectedMes)) {
    whereClauses.push(`DATE_FORMAT(v.fecha, '%Y-%m') = ?`);
    params.push(selectedMes);
  }

  if (normalized) {
    whereClauses.push(`(v.numero_venta LIKE ? OR c.nombres LIKE ? OR c.razon_social LIKE ?)`);
    params.push(`%${normalized}%`, `%${normalized}%`, `%${normalized}%`);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(" AND ");
  }

  sql += ` GROUP BY v.id_venta ORDER BY v.fecha DESC LIMIT 150`;

  try {
    let expenseSql = `SELECT COALESCE(SUM(monto), 0) AS total_gastos FROM gastos WHERE activo = 1`;
    const expenseParams: unknown[] = [];
    if (selectedMes && /^\d{4}-\d{2}$/.test(selectedMes)) {
      expenseSql += ` AND DATE_FORMAT(fecha, '%Y-%m') = ?`;
      expenseParams.push(selectedMes);
    }
    if (selectedLocalId && selectedLocalId > 0) {
      expenseSql += ` AND (id_local = ? OR id_local IS NULL)`;
      expenseParams.push(selectedLocalId);
    }

    const [rows, advisorRows, localRows, expenseRows] = await Promise.all([
      query<SaleListRowRaw>(sql, params),
      query<{ id: number; nombre: string }>(
        `SELECT id_usuario AS id, CONCAT(nombres, ' ', apellidos) AS nombre FROM usuarios WHERE activo = 1 AND id_perfil IN (1, 2, 3) AND nombres NOT LIKE '%Iralda%' AND apellidos NOT LIKE '%Manos%' ORDER BY nombres ASC`
      ),
      query<{ id: number; nombre: string }>(
        `SELECT id_local AS id, nombre FROM locales WHERE activo = 1 ORDER BY nombre ASC`
      ),
      query<{ total_gastos: number }>(expenseSql, expenseParams).catch(() => [{ total_gastos: 0 }]),
    ]);

    const totalGastos = Number(expenseRows?.[0]?.total_gastos) || 0;

    const mapped: SaleListItem[] = (rows ?? []).map((sale) => {
      const total = Number(sale.total) || 0;
      const utilidad = Number((total * 0.327).toFixed(2));
      const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number((utilidad * 0.40).toFixed(2));

      return {
        id_venta: Number(sale.id_venta),
        numero_venta: sale.numero_venta || `#${sale.id_venta}`,
        fecha: String(sale.fecha),
        local: sale.local_nombre ?? "Local",
        cliente: sale.cliente_nombre ?? "Consumidor final",
        canal: sale.canal_nombre ?? "Canal",
        vendedor: sale.vendedor_nombre ?? "Usuario",
        total,
        utilidad,
        comision_asesor: comisionAsesor,
        comision_local: comisionLocal,
        unidades: Number(sale.unidades) || 1,
        observaciones: sale.observaciones,
        estado: sale.estado,
      };
    });

    const totalComisionLocal = Number(mapped.reduce((sum, s) => sum + s.comision_local, 0).toFixed(2));
    const saldoComisionLocal = Number((totalComisionLocal - totalGastos).toFixed(2));

    const summary: SalesSummary = {
      totalVentas: Number(mapped.reduce((sum, s) => sum + s.total, 0).toFixed(2)),
      totalUtilidad: Number(mapped.reduce((sum, s) => sum + s.utilidad, 0).toFixed(2)),
      totalComisionAsesor: Number(mapped.reduce((sum, s) => sum + s.comision_asesor, 0).toFixed(2)),
      totalComisionLocal,
      totalGastos,
      saldoComisionLocal,
      totalUnidades: mapped.reduce((sum, s) => sum + s.unidades, 0),
    };

    return {
      sales: mapped,
      summary,
      advisors: (advisorRows ?? []).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      locales: (localRows ?? []).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      count: mapped.length,
      context,
    };
  } catch (error) {
    console.error("MySQL listSales ERROR:", error);
    throw new Error("No fue posible cargar las ventas.");
  }
}

type ReceiptHeaderRaw = {
  id_venta: number;
  numero_venta: string | null;
  fecha: Date | string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  estado: string;
  local_nombre: string | null;
  cliente_razon_social: string | null;
  cliente_nombres: string | null;
  cliente_identificacion: string | null;
  canal_nombre: string | null;
  vendedor_nombre: string | null;
};

type ReceiptDetailRaw = {
  id_detalle: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  iva: number;
  total: number;
  producto_descripcion: string;
  codigo_gs1: string;
};

type ReceiptPaymentRaw = {
  id_pago: number;
  valor: number;
  referencia: string | null;
  forma_pago_nombre: string | null;
};

export async function getSaleReceipt(id: number): Promise<SaleReceipt | null> {
  const context = await requirePermission("VENTA_VER");
  if (!Number.isInteger(id) || id <= 0) return null;

  try {
    let sql = `
      SELECT 
        v.id_venta,
        v.numero_venta,
        v.fecha,
        v.subtotal,
        v.descuento,
        v.iva,
        v.total,
        v.estado,
        l.nombre AS local_nombre,
        c.razon_social AS cliente_razon_social,
        c.nombres AS cliente_nombres,
        c.identificacion AS cliente_identificacion,
        ch.nombre AS canal_nombre,
        CONCAT(u.nombres, ' ', u.apellidos) AS vendedor_nombre
      FROM ventas v
      JOIN locales l ON l.id_local = v.id_local
      LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN canales_venta ch ON ch.id_canal = v.id_canal
      JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.id_venta = ?
    `;

    const params: unknown[] = [id];

    if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) {
      sql += ` AND v.id_local = ?`;
      params.push(context.id_local);
    }

    if (context.perfil === ROLE_NAMES.ASESOR) {
      sql += ` AND v.id_usuario = ?`;
      params.push(context.id_usuario);
    }

    sql += ` LIMIT 1`;

    const sale = await queryOne<ReceiptHeaderRaw>(sql, params);
    if (!sale) return null;

    const [details, payments] = await Promise.all([
      query<ReceiptDetailRaw>(
        `SELECT 
           d.id_detalle,
           d.cantidad,
           d.precio_unitario,
           d.subtotal,
           d.iva,
           d.total,
           p.descripcion AS producto_descripcion,
           COALESCE(vp.codigo_gs1, vp.codigo_interno, '—') AS codigo_gs1
         FROM detalle_ventas d
         JOIN variantes_producto vp ON vp.id_variante = d.id_variante
         JOIN productos p ON p.id_producto = vp.id_producto
         WHERE d.id_venta = ?
         ORDER BY d.id_detalle ASC`,
        [id]
      ),
      query<ReceiptPaymentRaw>(
        `SELECT 
           pv.id_pago,
           pv.valor,
           pv.referencia,
           fp.nombre AS forma_pago_nombre
         FROM pagos_venta pv
         JOIN formas_pago fp ON fp.id_forma_pago = pv.id_forma_pago
         WHERE pv.id_venta = ?
         ORDER BY pv.id_pago ASC`,
        [id]
      ),
    ]);

    const clienteNombre =
      sale.cliente_razon_social || sale.cliente_nombres || "Consumidor final";

    return {
      id_venta: Number(sale.id_venta),
      numero_venta: sale.numero_venta || `#${sale.id_venta}`,
      fecha: String(sale.fecha),
      local: sale.local_nombre ?? "Local",
      cliente: clienteNombre,
      identificacion: sale.cliente_identificacion ?? null,
      canal: sale.canal_nombre ?? "Canal",
      vendedor: sale.vendedor_nombre ?? "Usuario",
      subtotal: Number(sale.subtotal) || 0,
      descuento: Number(sale.descuento) || 0,
      iva: Number(sale.iva) || 0,
      total: Number(sale.total) || 0,
      estado: sale.estado,
      items: (details ?? []).map((d) => ({
        id_detalle: Number(d.id_detalle),
        producto: d.producto_descripcion,
        descripcion: d.producto_descripcion,
        codigo_gs1: d.codigo_gs1,
        cantidad: Number(d.cantidad),
        precio_unitario: Number(d.precio_unitario),
        subtotal: Number(d.subtotal),
        iva: Number(d.iva),
        total: Number(d.total),
      })),
      pagos: (payments ?? []).map((p) => ({
        id_pago: Number(p.id_pago),
        forma: p.forma_pago_nombre ?? "Pago",
        forma_pago: p.forma_pago_nombre ?? "Pago",
        valor: Number(p.valor),
        referencia: p.referencia ?? null,
      })),
    };
  } catch (error) {
    console.error("MySQL getSaleReceipt ERROR:", error);
    throw new Error("No fue posible cargar el comprobante.");
  }
}

type SaleHistoryRowRaw = {
  id_venta: number;
  numero_venta: string | null;
  fecha: Date | string;
  local_nombre: string | null;
  cliente_nombre: string | null;
  canal_nombre: string | null;
  vendedor_nombre: string | null;
  total: number;
  estado: string;
  payment_methods_concat: string | null;
};

export async function getSaleHistory(searchParams: {
  from?: string;
  to?: string;
  seller?: number;
  channel?: number;
  number?: string;
  paymentMethod?: number;
}) {
  const context = await requirePermission("VENTA_VER");

  const filterSchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    seller: z.coerce.number().int().positive().optional(),
    channel: z.coerce.number().int().positive().optional(),
    number: z.string().optional(),
    paymentMethod: z.coerce.number().int().positive().optional(),
  });

  const parsed = filterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};
  const number = filters.number ? cleanSearch(filters.number) : "";

  let sql = `
    SELECT 
      v.id_venta,
      v.numero_venta,
      v.fecha,
      l.nombre AS local_nombre,
      COALESCE(c.razon_social, c.nombres, c.identificacion, 'Consumidor final') AS cliente_nombre,
      ch.nombre AS canal_nombre,
      CONCAT(u.nombres, ' ', u.apellidos) AS vendedor_nombre,
      v.total,
      v.estado,
      GROUP_CONCAT(DISTINCT fp.nombre SEPARATOR ', ') AS payment_methods_concat
    FROM ventas v
    JOIN locales l ON l.id_local = v.id_local
    LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
    JOIN canales_venta ch ON ch.id_canal = v.id_canal
    JOIN usuarios u ON u.id_usuario = v.id_usuario
    LEFT JOIN pagos_venta pv ON pv.id_venta = v.id_venta
    LEFT JOIN formas_pago fp ON fp.id_forma_pago = pv.id_forma_pago
  `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) {
    whereClauses.push(`v.id_local = ?`);
    params.push(context.id_local);
  }

  if (context.perfil === ROLE_NAMES.ASESOR) {
    whereClauses.push(`v.id_usuario = ?`);
    params.push(context.id_usuario);
  }

  if (filters.from && validDate.test(filters.from)) {
    whereClauses.push(`v.fecha >= ?`);
    params.push(`${filters.from} 00:00:00`);
  }

  if (filters.to && validDate.test(filters.to)) {
    whereClauses.push(`v.fecha <= ?`);
    params.push(`${filters.to} 23:59:59`);
  }

  if (filters.seller && Number.isInteger(filters.seller)) {
    whereClauses.push(`v.id_usuario = ?`);
    params.push(filters.seller);
  }

  if (filters.channel && Number.isInteger(filters.channel)) {
    whereClauses.push(`v.id_canal = ?`);
    params.push(filters.channel);
  }

  if (number) {
    whereClauses.push(`v.numero_venta LIKE ?`);
    params.push(`%${number}%`);
  }

  if (filters.paymentMethod && Number.isInteger(filters.paymentMethod)) {
    whereClauses.push(`EXISTS (SELECT 1 FROM pagos_venta pv2 WHERE pv2.id_venta = v.id_venta AND pv2.id_forma_pago = ?)`);
    params.push(filters.paymentMethod);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(" AND ");
  }

  sql += ` GROUP BY v.id_venta ORDER BY v.fecha DESC LIMIT 200`;

  try {
    const [salesRows, sellerOptions, channelOptions, paymentOptions] = await Promise.all([
      query<SaleHistoryRowRaw>(sql, params),
      query<{ id_usuario: number; nombres: string; apellidos: string; id_local: number | null }>(
        `SELECT id_usuario, nombres, apellidos, id_local FROM usuarios WHERE activo = 1 AND nombres NOT LIKE '%Iralda%' AND apellidos NOT LIKE '%Manos%' ORDER BY nombres ASC`
      ),
      query<{ id_canal: number; nombre: string }>(
        `SELECT id_canal, nombre FROM canales_venta WHERE activo = 1 ORDER BY nombre ASC`
      ),
      query<{ id_forma_pago: number; nombre: string; codigo: string }>(
        `SELECT id_forma_pago, nombre, codigo FROM formas_pago WHERE activo = 1 AND codigo <> 'MIXTO' ORDER BY nombre ASC`
      ),
    ]);

    const sales: SaleHistoryItem[] = salesRows.map((sale) => {
      const total = Number(sale.total) || 0;
      const utilidad = Number((total * 0.327).toFixed(2));
      const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number((utilidad * 0.40).toFixed(2));

      return {
        id_venta: Number(sale.id_venta),
        numero_venta: sale.numero_venta || `#${sale.id_venta}`,
        fecha: String(sale.fecha),
        local: sale.local_nombre ?? "Local",
        cliente: sale.cliente_nombre ?? "Consumidor final",
        canal: sale.canal_nombre ?? "Canal",
        vendedor: sale.vendedor_nombre ?? "Usuario",
        total,
        utilidad,
        comision_asesor: comisionAsesor,
        comision_local: comisionLocal,
        unidades: 1,
        estado: sale.estado,
        paymentMethods: sale.payment_methods_concat || "Sin registro",
      };
    });

    const visibleSellers = (sellerOptions ?? []).filter(
      (seller) =>
        context.perfil === ROLE_NAMES.ADMINISTRADOR ||
        (context.perfil === ROLE_NAMES.VENTA_LOCAL && seller.id_local === context.id_local) ||
        seller.id_usuario === context.id_usuario
    );

    return {
      sales,
      sellers: visibleSellers.map((seller) => ({
        id: seller.id_usuario,
        name: `${seller.nombres} ${seller.apellidos}`.trim(),
      })),
      channels: channelOptions ?? [],
      paymentMethods: paymentOptions ?? [],
    };
  } catch (error) {
    console.error("MySQL getSaleHistory ERROR:", error);
    throw new Error("No fue posible cargar el historial de ventas.");
  }
}

type AuditRowRaw = {
  id_auditoria: number;
  usuario: number | null;
  tabla_afectada: string;
  accion: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: Date | string;
  usuario_nombre: string | null;
};

export async function getSaleDetail(id: number) {
  const receipt = await getSaleReceipt(id);
  if (!receipt) return null;

  try {
    const detailIds = receipt.items.map((item) => item.id_detalle);
    const paymentIds = receipt.pagos.map((payment) => payment.id_pago);

    let auditSql = `
      SELECT 
        a.id_auditoria,
        a.usuario,
        a.tabla_afectada,
        a.accion,
        a.valor_anterior,
        a.valor_nuevo,
        a.fecha,
        CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.usuario
      WHERE (a.tabla_afectada = 'ventas' AND a.registro_id = ?)
    `;
    const auditParams: unknown[] = [id];

    if (detailIds.length > 0) {
      const placeholders = detailIds.map(() => "?").join(", ");
      auditSql += ` OR (a.tabla_afectada = 'detalle_ventas' AND a.registro_id IN (${placeholders}))`;
      auditParams.push(...detailIds);
    }

    if (paymentIds.length > 0) {
      const placeholders = paymentIds.map(() => "?").join(", ");
      auditSql += ` OR (a.tabla_afectada = 'pagos_venta' AND a.registro_id IN (${placeholders}))`;
      auditParams.push(...paymentIds);
    }

    auditSql += ` ORDER BY a.fecha DESC`;

    const auditRows = await query<AuditRowRaw>(auditSql, auditParams);

    const audit: SaleAuditEntry[] = auditRows.map((entry) => ({
      id: Number(entry.id_auditoria),
      action: entry.accion,
      table: entry.tabla_afectada,
      date: String(entry.fecha),
      user: entry.usuario_nombre?.trim() || "Sistema",
      previousValue: typeof entry.valor_anterior === "string" ? JSON.parse(entry.valor_anterior) : null,
      newValue: typeof entry.valor_nuevo === "string" ? JSON.parse(entry.valor_nuevo) : null,
    }));

    return { ...receipt, audit };
  } catch (error) {
    console.error("MySQL getSaleDetail ERROR:", error);
    throw new Error("No fue posible cargar el detalle de la venta.");
  }
}

export async function getSaleWorkspaceContext() {
  const context = await requirePermission("VENTA_CREAR");
  await ensureCustomTables().catch(() => null);

  let locationsSql = `SELECT id_local, nombre FROM locales WHERE activo = 1`;
  const locationsParams: unknown[] = [];

  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR && context.id_local) {
    locationsSql += ` AND id_local = ?`;
    locationsParams.push(context.id_local);
  }
  locationsSql += ` ORDER BY nombre ASC`;

  try {
    const [locations, variants, products, warehouses, stocks, channels, paymentMethods, customers, sellers] =
      await Promise.all([
        query<{ id_local: number; nombre: string }>(locationsSql, locationsParams).catch(() => []),
        query<{
          id_variante: number;
          id_producto: number;
          codigo_gs1: string | null;
          codigo_interno: string | null;
          precio_venta: number;
          porcentaje_iva: number;
          stock_minimo: number;
        }>(
          `SELECT 
             vp.id_variante,
             vp.id_producto,
             vp.codigo_gs1,
             vp.codigo_interno,
             vp.precio_venta,
             vp.porcentaje_iva,
             vp.stock_minimo
           FROM variantes_producto vp
           JOIN productos p ON p.id_producto = vp.id_producto
           WHERE vp.activo = 1 AND p.activo = 1
           ORDER BY vp.id_variante ASC`
        ).catch(() => []),
        query<{ id_producto: number; descripcion: string; id_categoria: number; id_tipo: number }>(
          `SELECT id_producto, descripcion, id_categoria, id_tipo FROM productos WHERE activo = 1`
        ).catch(() => []),
        query<{ id_bodega: number; id_local: number; nombre: string }>(
          `SELECT id_bodega, id_local, nombre FROM bodegas WHERE activo = 1`
        ).catch(() => []),
        query<{ id_variante: number; id_bodega: number; cantidad: number }>(
          `SELECT id_variante, id_bodega, cantidad FROM stock_producto`
        ).catch(() => []),
        query<{ id_canal: number; nombre: string; codigo: string }>(
          `SELECT id_canal, nombre, codigo FROM canales_venta WHERE activo = 1 ORDER BY nombre ASC`
        ).catch(() => []),
        query<{ id_forma_pago: number; nombre: string; codigo: string; requiere_referencia: number | boolean }>(
          `SELECT id_forma_pago, nombre, codigo, requiere_referencia FROM formas_pago WHERE activo = 1 ORDER BY nombre ASC`
        ).catch(() => []),
        query<{
          id_cliente: number;
          identificacion: string;
          nombres: string;
          apellidos: string;
          razon_social: string | null;
        }>(
          `SELECT id_cliente, identificacion, nombres, apellidos, razon_social FROM clientes WHERE activo = 1 ORDER BY nombres ASC LIMIT 100`
        ).catch(() => []),
        query<{ id_usuario: number; nombres: string; apellidos: string; perfil: string }>(
          `SELECT u.id_usuario, u.nombres, u.apellidos, COALESCE(p.nombre, 'Usuario') AS perfil 
           FROM usuarios u 
           LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil 
           WHERE u.activo = 1 
           ORDER BY u.nombres ASC`
        ).catch(() => []),
      ]);

    const productMap = new Map((products ?? []).map((p) => [p.id_producto, p]));

    const warehouseLocationMap = new Map((warehouses ?? []).map((w) => [w.id_bodega, w.id_local]));
    const stockMapByVariantAndLocal = new Map<number, Record<number, number>>();
    for (const s of stocks ?? []) {
      const localId = warehouseLocationMap.get(s.id_bodega) || 1;
      if (!stockMapByVariantAndLocal.has(s.id_variante)) {
        stockMapByVariantAndLocal.set(s.id_variante, {});
      }
      const rec = stockMapByVariantAndLocal.get(s.id_variante)!;
      rec[localId] = (rec[localId] || 0) + Number(s.cantidad || 0);
    }

    const mappedVariants: SaleProduct[] = (variants ?? []).map((v) => {
      const prod = productMap.get(v.id_producto);
      const stockObj = stockMapByVariantAndLocal.get(Number(v.id_variante));
      return {
        id_variante: Number(v.id_variante),
        id_producto: Number(v.id_producto),
        codigo_gs1: v.codigo_gs1 || "",
        codigo_interno: v.codigo_interno || "",
        precio: Number(v.precio_venta),
        precio_venta: Number(v.precio_venta),
        porcentaje_iva: Number(v.porcentaje_iva),
        stock_minimo: Number(v.stock_minimo),
        producto: prod?.descripcion || "Producto",
        id_categoria: prod?.id_categoria || 1,
        id_tipo: prod?.id_tipo || 1,
        stockPorLocal: stockObj && Object.keys(stockObj).length > 0 ? stockObj : { 1: 10 },
      };
    });

    const safeLocations = locations && locations.length ? locations : [{ id_local: 1, nombre: "Local Matriz" }];
    const safeChannels = channels && channels.length ? channels : [
      { id_canal: 1, nombre: "Venta Local Matriz", codigo: "LOCAL" },
      { id_canal: 2, nombre: "Venta Asesor", codigo: "ASESOR" }
    ];
    const safePaymentMethods = paymentMethods && paymentMethods.length ? paymentMethods : [
      { id_forma_pago: 1, nombre: "Efectivo", codigo: "EFECTIVO", requiere_referencia: 0 },
      { id_forma_pago: 2, nombre: "Transferencia", codigo: "TRANSFERENCIA", requiere_referencia: 1 },
      { id_forma_pago: 3, nombre: "De Una", codigo: "DE_UNA", requiere_referencia: 1 },
      { id_forma_pago: 4, nombre: "Mixto", codigo: "MIXTO", requiere_referencia: 0 },
    ];
    const safeCustomers = customers && customers.length ? customers : [
      { id_cliente: 1, identificacion: "9999999999999", nombres: "Consumidor", apellidos: "Final", razon_social: "Consumidor Final" }
    ];

    const mappedLocations: SaleLocation[] = safeLocations;
    const mappedWarehouses: SaleWarehouse[] = warehouses && warehouses.length ? warehouses : [{ id_bodega: 1, id_local: 1, nombre: "Bodega Principal" }];
    const mappedStocks: SaleStock[] = (stocks ?? []).map((s) => ({
      id_variante: Number(s.id_variante),
      id_bodega: Number(s.id_bodega),
      cantidad: Number(s.cantidad),
    }));
    const mappedChannels: SaleChannel[] = safeChannels;
    const mappedPaymentMethods: SalePaymentMethod[] = safePaymentMethods.map((pm) => ({
      id_forma_pago: Number(pm.id_forma_pago),
      nombre: pm.nombre,
      codigo: pm.codigo,
      requiere_referencia: Boolean(pm.requiere_referencia),
    }));
    const mappedCustomers: SaleCustomer[] = safeCustomers.map((c) => {
      const clientName = c.razon_social || `${c.nombres} ${c.apellidos}`.trim();
      return {
        id_cliente: Number(c.id_cliente),
        identificacion: c.identificacion,
        nombre: clientName,
        name: clientName,
      };
    });

    const mappedSellers = (sellers ?? []).map((u) => ({
      id_usuario: Number(u.id_usuario),
      nombre: `${u.nombres} ${u.apellidos}`.trim(),
      perfil: u.perfil,
    }));

    return {
      locations: mappedLocations,
      variants: mappedVariants,
      products: mappedVariants,
      warehouses: mappedWarehouses,
      stocks: mappedStocks,
      channels: mappedChannels,
      paymentMethods: mappedPaymentMethods,
      customers: mappedCustomers,
      sellers: mappedSellers,
      context,
    };
  } catch (error) {
    console.error("MySQL getSaleWorkspaceContext ERROR:", error);
    return {
      locations: [{ id_local: 1, nombre: "Local Matriz" }],
      variants: [],
      products: [],
      warehouses: [{ id_bodega: 1, id_local: 1, nombre: "Bodega Principal" }],
      stocks: [],
      channels: [
        { id_canal: 1, nombre: "Local Matriz", codigo: "LOCAL" },
        { id_canal: 2, nombre: "Venta Asesor", codigo: "ASESOR" },
        { id_canal: 3, nombre: "WhatsApp", codigo: "WHATSAPP" },
        { id_canal: 4, nombre: "Instagram", codigo: "INSTAGRAM" },
        { id_canal: 5, nombre: "TikTok", codigo: "TIKTOK" },
        { id_canal: 6, nombre: "Facebook", codigo: "FACEBOOK" },
        { id_canal: 7, nombre: "Otros", codigo: "OTROS" },
      ],
      paymentMethods: [{ id_forma_pago: 1, nombre: "Efectivo", codigo: "EFECTIVO", requiere_referencia: false }],
      customers: [{ id_cliente: 1, identificacion: "9999999999999", nombre: "Consumidor Final", name: "Consumidor Final" }],
      sellers: [],
      context,
    };
  }
}

export async function createQuickCustomer(data: {
  identificacion: string;
  nombres: string;
  apellidos?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
}): Promise<{ id_cliente: number; nombre: string; identificacion: string }> {
  await requireAnyPermission(["VENTA_CREAR", "VENTA_VER", "USUARIO_VER"]);

  const cleanIdentificacion = data.identificacion.trim();
  const cleanNombres = data.nombres.trim();
  const cleanApellidos = data.apellidos?.trim() || "";
  const razonSocial = cleanApellidos ? `${cleanNombres} ${cleanApellidos}` : cleanNombres;

  const result = await execute(
    `INSERT INTO clientes (identificacion, nombres, apellidos, razon_social, correo, telefono, direccion, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE 
       nombres = VALUES(nombres),
       apellidos = VALUES(apellidos),
       razon_social = VALUES(razon_social),
       correo = VALUES(correo),
       telefono = VALUES(telefono),
       direccion = VALUES(direccion),
       activo = 1`,
    [
      cleanIdentificacion,
      cleanNombres,
      cleanApellidos,
      razonSocial,
      data.correo?.trim() || null,
      data.telefono?.trim() || null,
      data.direccion?.trim() || null,
    ]
  );

  let clienteId = Number(result.insertId);
  if (!clienteId || clienteId === 0) {
    const existing = await queryOne<{ id_cliente: number }>(
      `SELECT id_cliente FROM clientes WHERE identificacion = ? LIMIT 1`,
      [cleanIdentificacion]
    );
    clienteId = existing?.id_cliente || 1;
  }

  return {
    id_cliente: clienteId,
    identificacion: cleanIdentificacion,
    nombre: razonSocial,
  };
}

