"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSaleTransaction, saleTransactionSchema } from "@/src/services/sales/transactions";
import { publicError, type ActionErrorState } from "@/src/lib/errors";

export type SaleActionState = ActionErrorState;

export async function createSaleAction(_state: SaleActionState, formData: FormData): Promise<SaleActionState> {
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string" || rawPayload.length > 100_000) return { error: "Los datos de la venta no son válidos." };
  let payload: unknown;
  try { payload = JSON.parse(rawPayload); } catch { return { error: "Los datos de la venta no son válidos." }; }
  const parsed = saleTransactionSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise los datos de la venta." };
  let sale: Awaited<ReturnType<typeof createSaleTransaction>>;
  try { sale = await createSaleTransaction(parsed.data); }
  catch (error) { const result = publicError(error, "No fue posible registrar la venta."); return { error: result.message, code: result.code }; }
  revalidatePath("/ventas"); revalidatePath("/dashboard"); revalidatePath("/inventario"); revalidatePath("/inventario/movimientos");
  redirect(`/ventas/${sale.id}/comprobante?created=1`);
}
