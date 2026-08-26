import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export type InventoryAlert = {
  id_stock: number;
  id_producto: number;
  producto: string;
  codigo_gs1: string;
  bodega: string;
  stock_actual: number;
  stock_minimo: number;
  type: "OUT_OF_STOCK" | "LOW_STOCK";
};

type AlertRow = {
  id_stock: number;
  id_producto: number;
  producto: string;
  codigo_gs1: string;
  bodega: string;
  stock_actual: number;
  stock_minimo: number;
  estado_stock: string;
};

/**
 * Consulta las alertas de stock mediante JOIN directo a las tablas base
 * para garantizar funcionamiento sin importar si las vistas SQL existen o no.
 */
async function queryInventoryAlerts(): Promise<AlertRow[]> {
  try {
    return await query<AlertRow>(
      `SELECT 
         sp.id_stock,
         p.id_producto,
         p.descripcion AS producto,
         COALESCE(vp.codigo_gs1, vp.codigo_interno, '—') AS codigo_gs1,
         b.nombre AS bodega,
         sp.cantidad AS stock_actual,
         vp.stock_minimo,
         CASE
           WHEN sp.cantidad <= 0 THEN 'AGOTADO'
           WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
           ELSE 'DISPONIBLE'
         END AS estado_stock
       FROM stock_producto sp
       JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
       JOIN productos p ON p.id_producto = vp.id_producto
       JOIN bodegas b ON b.id_bodega = sp.id_bodega
       WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
         AND (sp.cantidad <= 0 OR sp.cantidad <= vp.stock_minimo)
       ORDER BY sp.cantidad ASC, p.descripcion ASC
       LIMIT 200`
    );
  } catch (error) {
    console.error("queryInventoryAlerts ERROR:", error);
    return [];
  }
}

export async function getAlertCount(): Promise<number> {
  try {
    const data = await queryInventoryAlerts();
    return data.length;
  } catch (error) {
    console.error("MySQL alert count ERROR:", error);
    return 0;
  }
}

export async function getAlerts(requestedType = "") {
  await requirePermission("INVENTARIO_VER");
  
  try {
    const data = await queryInventoryAlerts();
    
    const alerts: InventoryAlert[] = (data ?? []).map((item) => ({
      id_stock: Number(item.id_stock),
      id_producto: Number(item.id_producto),
      producto: item.producto || "Producto",
      codigo_gs1: item.codigo_gs1 || "—",
      bodega: item.bodega || "Bodega",
      stock_actual: Number(item.stock_actual) || 0,
      stock_minimo: Number(item.stock_minimo) || 0,
      type: item.estado_stock === "AGOTADO" ? "OUT_OF_STOCK" : "LOW_STOCK",
    }));

    const type = requestedType === "agotado" || requestedType === "minimo" ? requestedType : "";

    return {
      alerts: type
        ? alerts.filter((alert) =>
            type === "agotado" ? alert.type === "OUT_OF_STOCK" : alert.type === "LOW_STOCK"
          )
        : alerts,
      type,
      summary: {
        total: alerts.length,
        low: alerts.filter((alert) => alert.type === "LOW_STOCK").length,
        out: alerts.filter((alert) => alert.type === "OUT_OF_STOCK").length,
      },
    };
  } catch (error) {
    console.error("MySQL getAlerts ERROR:", error);
    return {
      alerts: [],
      type: "",
      summary: { total: 0, low: 0, out: 0 },
    };
  }
}
