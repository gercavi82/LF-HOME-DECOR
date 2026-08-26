import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requireAnyPermission } from "@/src/services/auth/authorization";

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
};

export type PurchasesSummary = {
  total: number;
  unidades: number;
  count: number;
  promedio: number;
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
};

export async function listPurchases(filters?: {
  month?: string; // YYYY-MM
}): Promise<{ purchases: PurchaseItem[]; summary: PurchasesSummary }> {
  await requireAnyPermission([
    "COMPRA_VER",
    "INVENTARIO_VER",
    "PRODUCTO_VER",
    "DASHBOARD_VER",
    "VENTA_VER",
  ]);

  let sql = `
    SELECT 
      c.id_compra,
      c.numero_compra,
      c.fecha,
      c.subtotal,
      c.iva,
      c.total,
      c.estado,
      c.observaciones,
      COALESCE(p.nombre, 'Distribuidora Nacional de Blancos') AS proveedor_nombre,
      CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre,
      COALESCE(SUM(dc.cantidad), 0) AS unidades,
      GROUP_CONCAT(DISTINCT prod.descripcion SEPARATOR ', ') AS producto_desc
    FROM compras c
    LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
    LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
    LEFT JOIN detalle_compras dc ON dc.id_compra = c.id_compra
    LEFT JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
    LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
    WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
  `;

  const params: unknown[] = [];

  if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    sql += ` AND DATE_FORMAT(c.fecha, '%Y-%m') = ?`;
    params.push(filters.month);
  }

  sql += `
    GROUP BY c.id_compra
    ORDER BY c.fecha DESC, c.id_compra DESC
    LIMIT 200
  `;

  try {
    const rows = await query<PurchaseRowRaw>(sql, params).catch(() => []);

    const purchases: PurchaseItem[] = (rows ?? []).map((r) => ({
      id_compra: Number(r.id_compra),
      numero_compra: r.numero_compra || `#${r.id_compra}`,
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
      proveedor: r.proveedor_nombre ?? "Distribuidora Nacional",
      subtotal: Number(r.subtotal) || 0,
      iva: Number(r.iva) || 0,
      total: Number(r.total) || 0,
      unidades: Number(r.unidades) || 0,
      producto: r.producto_desc || "Edredones / Sábanas",
      estado: r.estado,
      observaciones: r.observaciones ?? null,
      usuario: r.usuario_nombre ?? "Administrador",
    }));

    const total = purchases.reduce((sum, p) => sum + p.total, 0);
    const unidades = purchases.reduce((sum, p) => sum + p.unidades, 0);
    const count = purchases.length;
    const promedio = count > 0 ? Number((total / count).toFixed(2)) : 0;

    return {
      purchases,
      summary: { total, unidades, count, promedio },
    };
  } catch (error) {
    console.error("listPurchases ERROR:", error);
    return {
      purchases: [],
      summary: { total: 0, unidades: 0, count: 0, promedio: 0 },
    };
  }
}
