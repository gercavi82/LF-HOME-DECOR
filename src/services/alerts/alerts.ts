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

async function queryInventoryAlerts(): Promise<AlertRow[]> {
  return query<AlertRow>(
    `SELECT 
       id_stock,
       id_producto,
       producto,
       codigo_gs1,
       bodega,
       stock_actual,
       stock_minimo,
       estado_stock
     FROM vw_inventario_actual
     WHERE estado_stock IN ('BAJO STOCK', 'AGOTADO')
     ORDER BY stock_actual ASC, producto ASC
     LIMIT 200`
  );
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
    
    const alerts: InventoryAlert[] = data.map((item) => ({
      id_stock: Number(item.id_stock),
      id_producto: Number(item.id_producto),
      producto: item.producto,
      codigo_gs1: item.codigo_gs1,
      bodega: item.bodega,
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
    throw new Error("No fue posible cargar las alertas.");
  }
}
