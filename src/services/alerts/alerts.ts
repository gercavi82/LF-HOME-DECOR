import "server-only";

import { createClient } from "@/src/lib/supabase/server";
import { requirePermission } from "@/src/services/auth/authorization";

export type InventoryAlert = { id_stock: number; id_producto: number; producto: string; codigo_gs1: string; bodega: string; stock_actual: number; stock_minimo: number; type: "OUT_OF_STOCK" | "LOW_STOCK" };

async function queryInventoryAlerts() {
  const supabase = await createClient();
  return supabase.from("vw_inventario_actual").select("id_stock, id_producto, producto, codigo_gs1, bodega, stock_actual, stock_minimo, estado_stock").in("estado_stock", ["BAJO STOCK", "AGOTADO"]).order("stock_actual").order("producto").limit(200);
}

export async function getAlertCount() {
  const { data, error } = await queryInventoryAlerts();
  if (error) {
    console.error("SUPABASE alert count ERROR:", { code: error.code, message: error.message });
    return 0;
  }
  return data?.length ?? 0;
}

export async function getAlerts(requestedType = "") {
  await requirePermission("INVENTARIO_VER");
  const { data, error } = await queryInventoryAlerts();
  if (error) throw new Error("No fue posible cargar las alertas.");
  const alerts: InventoryAlert[] = (data ?? []).map((item) => ({ id_stock: item.id_stock, id_producto: item.id_producto, producto: item.producto, codigo_gs1: item.codigo_gs1, bodega: item.bodega, stock_actual: Number(item.stock_actual) || 0, stock_minimo: Number(item.stock_minimo) || 0, type: item.estado_stock === "AGOTADO" ? "OUT_OF_STOCK" : "LOW_STOCK" }));
  const type = requestedType === "agotado" || requestedType === "minimo" ? requestedType : "";
  return { alerts: type ? alerts.filter((alert) => type === "agotado" ? alert.type === "OUT_OF_STOCK" : alert.type === "LOW_STOCK") : alerts, type, summary: { total: alerts.length, low: alerts.filter((alert) => alert.type === "LOW_STOCK").length, out: alerts.filter((alert) => alert.type === "OUT_OF_STOCK").length } };
}
