import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { fromDatabaseError } from "@/src/lib/errors";
import { requirePermission } from "@/src/services/auth/authorization";

export const saleTransactionSchema = z.object({
  id_local: z.number().int().positive(),
  id_cliente: z.number().int().positive().nullable(),
  id_canal: z.number().int().positive(),
  descuento: z.number().min(0).max(999999.99),
  observaciones: z.string().trim().max(500).optional(),
  items: z.array(z.object({ id_variante: z.number().int().positive(), cantidad: z.number().positive().max(999999) })).min(1).max(100),
  pagos: z.array(z.object({ id_forma_pago: z.number().int().positive(), valor: z.number().positive().max(999999.99), referencia: z.string().trim().max(150).nullable() })).min(1).max(10),
});

export type SaleTransactionInput = z.infer<typeof saleTransactionSchema>;

export async function createSaleTransaction(input: SaleTransactionInput) {
  const context = await requirePermission("VENTA_CREAR");
  const parsed = saleTransactionSchema.parse(input);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("sp_registrar_venta", {
    p_local: parsed.id_local,
    p_cliente: parsed.id_cliente,
    p_canal: parsed.id_canal,
    p_usuario: context.id_usuario,
    p_descuento: parsed.descuento,
    p_items: parsed.items,
    p_pagos: parsed.pagos,
    p_observaciones: parsed.observaciones || null,
  });
  if (error) {
    console.error("SUPABASE sale transaction ERROR:", { code: error.code, message: error.message });
    throw fromDatabaseError(error, "No fue posible registrar la venta.");
  }
  const result = data as { id_venta?: number; numero_venta?: string; total?: number } | null;
  if (!result?.id_venta || !result.numero_venta) throw new Error("La transacción no devolvió una venta válida.");
  return { id: result.id_venta, number: result.numero_venta, total: Number(result.total) };
}
