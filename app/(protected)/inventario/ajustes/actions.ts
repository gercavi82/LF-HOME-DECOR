"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { inventoryMovementTypeSchema, registerInventoryMovement } from "@/src/services/inventory/movements";
import { publicError, type ActionErrorState } from "@/src/lib/errors";

export type AdjustmentState = ActionErrorState;
const adjustmentTypes = [
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "AJUSTE_SOBRANTE",
  "AJUSTE_FALTANTE",
  "PERDIDA",
  "DANO",
  "CORRECCION_ENTRADA",
  "CORRECCION_SALIDA",
  "ENTRADA_INICIAL",
] as const;

const adjustmentSchema = z.object({
  id_variante: z.coerce.number().int().positive("Seleccione un producto."),
  id_bodega: z.coerce.number().int().positive("Seleccione una bodega."),
  tipo: z.string().refine((type) => (adjustmentTypes as readonly string[]).includes(type), "Tipo de ajuste inválido."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que cero.").max(999999),
  motivo: z.string().trim().min(5, "Explique el motivo del ajuste.").max(500),
});

export async function createAdjustmentAction(_state: AdjustmentState, formData: FormData): Promise<AdjustmentState> {
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  let movementId: number;
  try {
    movementId = await registerInventoryMovement({
      id_variante: parsed.data.id_variante,
      id_bodega: parsed.data.id_bodega,
      tipo: parsed.data.tipo,
      cantidad: parsed.data.cantidad,
      motivo: parsed.data.motivo,
      referencia_tipo: "AJUSTE_MANUAL",
    });
  } catch (error) {
    const result = publicError(error, "No fue posible registrar el ajuste.");
    return { error: result.message, code: result.code };
  }
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimientos");
  redirect(`/inventario/movimientos?created=${movementId}`);
}
