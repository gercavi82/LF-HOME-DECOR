import "server-only";

import { z } from "zod";

import { createClient } from "@/src/lib/supabase/server";
import { requirePermission } from "@/src/services/auth/authorization";

export const inventoryStatusSchema = z.enum(["DISPONIBLE", "BAJO STOCK", "AGOTADO"]);
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;

export type InventoryItem = {
  id_stock: number;
  id_producto: number;
  id_variante: number;
  id_bodega: number;
  producto: string;
  codigo_gs1: string;
  bodega: string;
  categoria: string | null;
  marca: string | null;
  tamano: string | null;
  color: string | null;
  stock_actual: number;
  stock_minimo: number;
  estado_stock: InventoryStatus;
};

function sanitizeSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

export async function getInventory(search = "", requestedStatus = "") {
  await requirePermission("INVENTARIO_VER");
  const supabase = await createClient();
  const normalized = sanitizeSearch(search);
  const parsedStatus = inventoryStatusSchema.safeParse(requestedStatus);

  let query = supabase
    .from("vw_inventario_actual")
    .select("id_stock, id_producto, id_variante, id_bodega, producto, codigo_gs1, bodega, categoria, marca, tamano, color, stock_actual, stock_minimo, estado_stock", { count: "exact" })
    .order("producto")
    .order("bodega")
    .limit(200);

  if (normalized) {
    const pattern = `%${normalized}%`;
    query = query.or(`producto.ilike.${pattern},codigo_gs1.ilike.${pattern},bodega.ilike.${pattern}`);
  }
  if (parsedStatus.success) query = query.eq("estado_stock", parsedStatus.data);

  const [itemsResult, availableResult, lowResult, outResult] = await Promise.all([
    query,
    supabase.from("vw_inventario_actual").select("id_stock", { count: "exact", head: true }).eq("estado_stock", "DISPONIBLE"),
    supabase.from("vw_inventario_actual").select("id_stock", { count: "exact", head: true }).eq("estado_stock", "BAJO STOCK"),
    supabase.from("vw_inventario_actual").select("id_stock", { count: "exact", head: true }).eq("estado_stock", "AGOTADO"),
  ]);

  const errors = [itemsResult.error, availableResult.error, lowResult.error, outResult.error].filter(Boolean);
  if (errors.length) {
    console.error("SUPABASE inventory ERROR:", errors.map((error) => ({ code: error?.code, message: error?.message })));
    throw new Error("No fue posible cargar el inventario.");
  }

  const items: InventoryItem[] = (itemsResult.data ?? []).map((item) => ({
    ...item,
    stock_actual: Number(item.stock_actual) || 0,
    stock_minimo: Number(item.stock_minimo) || 0,
    estado_stock: inventoryStatusSchema.catch("DISPONIBLE").parse(item.estado_stock),
  }));

  return {
    items,
    count: itemsResult.count ?? items.length,
    summary: {
      available: availableResult.count ?? 0,
      low: lowResult.count ?? 0,
      out: outResult.count ?? 0,
      total: (availableResult.count ?? 0) + (lowResult.count ?? 0) + (outResult.count ?? 0),
    },
    status: parsedStatus.success ? parsedStatus.data : null,
  };
}
