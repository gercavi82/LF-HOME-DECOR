import "server-only";

import { z } from "zod";
import { query, transaction } from "@/src/lib/db/mysql";
import { requirePermission, ROLE_NAMES } from "@/src/services/auth/authorization";
import {
  INVENTORY_MOVEMENT_TYPES,
  inventoryMovementTypeSchema,
  type InventoryMovementType,
} from "@/src/services/inventory/types";
import { applyStockMovement } from "@/src/services/inventory/apply-stock-movement";

export { INVENTORY_MOVEMENT_TYPES, inventoryMovementTypeSchema, type InventoryMovementType };

const registerMovementSchema = z.object({
  id_variante: z.number().int().positive("Seleccione un producto."),
  id_bodega: z.number().int().positive("Seleccione una bodega."),
  tipo: inventoryMovementTypeSchema,
  cantidad: z.number().positive("La cantidad debe ser mayor que cero."),
  motivo: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres.").max(500),
  referencia_tipo: z.string().trim().max(50).optional(),
  referencia_id: z.number().int().positive().optional(),
});

export async function registerInventoryMovement(input: unknown): Promise<number> {
  const context = await requirePermission("INVENTARIO_AJUSTAR");
  const parsed = registerMovementSchema.parse(input);

  return transaction(async (conn) => {
    const result = await applyStockMovement({
      connection: conn,
      idVariante: parsed.id_variante,
      idBodega: parsed.id_bodega,
      tipo: parsed.tipo,
      cantidad: parsed.cantidad,
      motivo: parsed.motivo,
      referenciaTipo: parsed.referencia_tipo?.trim() || "AJUSTE_MANUAL",
      referenciaId: parsed.referencia_id ?? null,
      usuarioId: context.id_usuario,
    });

    return result.idMovimiento;
  });
}

export type AdjustmentOption = { id_variante: number; id_producto: number; producto: string; codigo_gs1: string };
export type WarehouseOption = { id_bodega: number; nombre: string };
export type StockOption = { id_variante: number; id_bodega: number; cantidad: number };

export async function getAdjustmentOptions() {
  const context = await requirePermission("INVENTARIO_AJUSTAR");

  let warehouseSql = `SELECT id_bodega, nombre, id_local FROM bodegas WHERE activo = 1`;
  const warehouseParams: unknown[] = [];

  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR && context.id_local) {
    warehouseSql += ` AND id_local = ?`;
    warehouseParams.push(context.id_local);
  }
  warehouseSql += ` ORDER BY nombre ASC`;

  try {
    const [variants, warehouses, stocks] = await Promise.all([
      query<{ id_variante: number; id_producto: number; codigo_gs1: string; producto: string }>(
        `SELECT 
           vp.id_variante, 
           vp.id_producto, 
           COALESCE(vp.codigo_gs1, vp.codigo_interno) AS codigo_gs1,
           p.descripcion AS producto
         FROM variantes_producto vp
         JOIN productos p ON p.id_producto = vp.id_producto
         WHERE vp.activo = 1 AND p.activo = 1
         ORDER BY vp.codigo_gs1 ASC`
      ),
      query<{ id_bodega: number; nombre: string }>(warehouseSql, warehouseParams),
      query<{ id_variante: number; id_bodega: number; cantidad: number }>(
        `SELECT id_variante, id_bodega, cantidad FROM stock_producto`
      ),
    ]);

    const productOptions: AdjustmentOption[] = (variants ?? []).map((v) => ({
      id_variante: Number(v.id_variante),
      id_producto: Number(v.id_producto),
      producto: v.producto,
      codigo_gs1: v.codigo_gs1 || "—",
    }));

    const warehouseOptions: WarehouseOption[] = (warehouses ?? []).map((w) => ({
      id_bodega: Number(w.id_bodega),
      nombre: w.nombre,
    }));

    const allowedWarehouses = new Set(warehouseOptions.map((w) => w.id_bodega));
    const stockOptions: StockOption[] = (stocks ?? [])
      .filter((s) => allowedWarehouses.has(Number(s.id_bodega)))
      .map((s) => ({
        id_variante: Number(s.id_variante),
        id_bodega: Number(s.id_bodega),
        cantidad: Number(s.cantidad) || 0,
      }));

    return { products: productOptions, warehouses: warehouseOptions, stocks: stockOptions };
  } catch (error) {
    console.error("MySQL getAdjustmentOptions ERROR:", error);
    throw new Error("No fue posible cargar las opciones del ajuste.");
  }
}

type MovementRowRaw = {
  id_movimiento: number;
  id_variante: number;
  id_bodega: number;
  tipo: string;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  usuario: number | null;
  fecha: Date;
  codigo_gs1: string;
  producto: string;
  bodega: string;
  responsable: string;
};

export async function listInventoryMovements() {
  await requirePermission("INVENTARIO_VER");

  try {
    const rows = await query<MovementRowRaw>(
      `SELECT 
         m.id_movimiento,
         m.id_variante,
         m.id_bodega,
         m.tipo,
         m.cantidad,
         m.stock_anterior,
         m.stock_nuevo,
         m.motivo,
         m.referencia_tipo,
         m.referencia_id,
         m.usuario,
         m.fecha,
         COALESCE(vp.codigo_gs1, vp.codigo_interno, '—') AS codigo_gs1,
         p.descripcion AS producto,
         b.nombre AS bodega,
         COALESCE(CONCAT(u.nombres, ' ', u.apellidos), 'Sistema') AS responsable
       FROM movimientos_inventario m
       JOIN variantes_producto vp ON vp.id_variante = m.id_variante
       JOIN productos p ON p.id_producto = vp.id_producto
       JOIN bodegas b ON b.id_bodega = m.id_bodega
       LEFT JOIN usuarios u ON u.id_usuario = m.usuario
       ORDER BY m.fecha DESC, m.id_movimiento DESC
       LIMIT 100`
    );

    return (rows ?? []).map((row) => ({
      id_movimiento: Number(row.id_movimiento),
      id_variante: Number(row.id_variante),
      id_bodega: Number(row.id_bodega),
      tipo: row.tipo,
      cantidad: Number(row.cantidad),
      stock_anterior: Number(row.stock_anterior),
      stock_nuevo: Number(row.stock_nuevo),
      motivo: row.motivo,
      referencia_tipo: row.referencia_tipo,
      referencia_id: row.referencia_id ? Number(row.referencia_id) : null,
      usuario: row.usuario ? Number(row.usuario) : null,
      fecha: row.fecha,
      codigo_gs1: row.codigo_gs1,
      producto: row.producto,
      bodega: row.bodega,
      responsable: row.responsable,
    }));
  } catch (error) {
    console.error("MySQL listInventoryMovements ERROR:", error);
    throw new Error("No fue posible cargar los movimientos.");
  }
}
