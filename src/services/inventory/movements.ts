import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { fromDatabaseError } from "@/src/lib/errors";
import { requirePermission, ROLE_NAMES } from "@/src/services/auth/authorization";

export const inventoryMovementTypes = ["ENTRADA_INICIAL", "COMPRA", "VENTA", "DEVOLUCION_COMPRA", "DEVOLUCION_VENTA", "AJUSTE_SOBRANTE", "AJUSTE_FALTANTE", "PERDIDA", "DANO", "CORRECCION_ENTRADA", "CORRECCION_SALIDA"] as const;
export const inventoryMovementTypeSchema = z.enum(inventoryMovementTypes);

export const inventoryMovementSchema = z.object({
  id_variante: z.coerce.number().int().positive(),
  id_bodega: z.coerce.number().int().positive(),
  tipo: inventoryMovementTypeSchema,
  cantidad: z.coerce.number().positive().max(999999),
  motivo: z.string().trim().max(500).optional(),
  referencia_tipo: z.string().trim().max(50).optional(),
  referencia_id: z.coerce.number().int().positive().optional(),
});

export async function registerInventoryMovement(input: z.infer<typeof inventoryMovementSchema>) {
  const context = await requirePermission("INVENTARIO_AJUSTAR");
  const parsed = inventoryMovementSchema.parse(input);
  const admin = createAdminClient();
  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR) {
    const { data: warehouse, error: warehouseError } = await admin.from("bodegas").select("id_local").eq("id_bodega", parsed.id_bodega).maybeSingle();
    if (warehouseError || !warehouse || !context.id_local || warehouse.id_local !== context.id_local) {
      throw new Error("No puede registrar movimientos en una bodega de otro local.");
    }
  }
  const { data, error } = await admin.rpc("sp_registrar_movimiento_inventario", {
    p_variante: parsed.id_variante, p_bodega: parsed.id_bodega, p_tipo: parsed.tipo,
    p_cantidad: parsed.cantidad, p_usuario: context.id_usuario, p_motivo: parsed.motivo || null,
    p_referencia_tipo: parsed.referencia_tipo || null, p_referencia_id: parsed.referencia_id ?? null,
  });
  if (error) throw fromDatabaseError(error, "No fue posible registrar el movimiento.");
  return Number(data);
}

export type AdjustmentOption = { id_variante: number; id_producto: number; producto: string; codigo_gs1: string };
export type WarehouseOption = { id_bodega: number; nombre: string };
export type StockOption = { id_variante: number; id_bodega: number; cantidad: number };

export async function getAdjustmentOptions() {
  const context = await requirePermission("INVENTARIO_AJUSTAR");
  const admin = createAdminClient();
  let warehouseQuery = admin.from("bodegas").select("id_bodega, nombre, id_local").eq("activo", true).order("nombre");
  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR && context.id_local) warehouseQuery = warehouseQuery.eq("id_local", context.id_local);
  const [{ data: variants, error: variantsError }, { data: products, error: productsError }, { data: warehouses, error: warehousesError }, { data: stocks, error: stocksError }] = await Promise.all([
    admin.from("variantes_producto").select("id_variante, id_producto, codigo_gs1").eq("activo", true).order("codigo_gs1"),
    admin.from("productos").select("id_producto, descripcion").eq("activo", true),
    warehouseQuery,
    admin.from("stock_producto").select("id_variante, id_bodega, cantidad"),
  ]);
  if (variantsError || productsError || warehousesError || stocksError) throw new Error("No fue posible cargar las opciones del ajuste.");
  const productMap = new Map((products ?? []).map((product) => [product.id_producto, product.descripcion]));
  const productOptions: AdjustmentOption[] = (variants ?? []).map((variant) => ({ id_variante: variant.id_variante, id_producto: variant.id_producto, producto: productMap.get(variant.id_producto) ?? "Producto", codigo_gs1: variant.codigo_gs1 }));
  const warehouseOptions: WarehouseOption[] = (warehouses ?? []).map((warehouse) => ({ id_bodega: warehouse.id_bodega, nombre: warehouse.nombre }));
  const allowedWarehouses = new Set(warehouseOptions.map((warehouse) => warehouse.id_bodega));
  const stockOptions: StockOption[] = (stocks ?? []).filter((stock) => allowedWarehouses.has(stock.id_bodega)).map((stock) => ({ id_variante: stock.id_variante, id_bodega: stock.id_bodega, cantidad: Number(stock.cantidad) || 0 }));
  return { products: productOptions, warehouses: warehouseOptions, stocks: stockOptions };
}

export async function listInventoryMovements() {
  await requirePermission("INVENTARIO_VER");
  const admin = createAdminClient();
  const { data, error } = await admin.from("movimientos_inventario").select("id_movimiento, id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario, fecha").order("fecha", { ascending: false }).limit(100);
  if (error) throw new Error("No fue posible cargar los movimientos.");
  const rows = data ?? [];
  const variantIds = [...new Set(rows.map((row) => row.id_variante))];
  const warehouseIds = [...new Set(rows.map((row) => row.id_bodega))];
  const userIds = [...new Set(rows.map((row) => row.usuario).filter((id): id is number => id !== null))];
  const [{ data: variants }, { data: warehouses }, { data: users }] = await Promise.all([
    variantIds.length ? admin.from("variantes_producto").select("id_variante, codigo_gs1, id_producto").in("id_variante", variantIds) : Promise.resolve({ data: [] }),
    warehouseIds.length ? admin.from("bodegas").select("id_bodega, nombre").in("id_bodega", warehouseIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from("usuarios").select("id_usuario, nombres, apellidos").in("id_usuario", userIds) : Promise.resolve({ data: [] }),
  ]);
  const productIds = [...new Set((variants ?? []).map((variant) => variant.id_producto))];
  const { data: products } = productIds.length ? await admin.from("productos").select("id_producto, descripcion").in("id_producto", productIds) : { data: [] };
  const variantMap = new Map((variants ?? []).map((item) => [item.id_variante, item]));
  const productMap = new Map((products ?? []).map((item) => [item.id_producto, item.descripcion]));
  const warehouseMap = new Map((warehouses ?? []).map((item) => [item.id_bodega, item.nombre]));
  const userMap = new Map((users ?? []).map((item) => [item.id_usuario, `${item.nombres} ${item.apellidos}`]));
  return rows.map((row) => { const variant = variantMap.get(row.id_variante); return { ...row, cantidad: Number(row.cantidad), stock_anterior: Number(row.stock_anterior), stock_nuevo: Number(row.stock_nuevo), codigo_gs1: variant?.codigo_gs1 ?? "—", producto: variant ? productMap.get(variant.id_producto) ?? "Producto" : "Producto", bodega: warehouseMap.get(row.id_bodega) ?? "Bodega", responsable: row.usuario ? userMap.get(row.usuario) ?? "Usuario" : "Sistema" }; });
}
