"use server";

import { revalidatePath } from "next/cache";
import { registerPurchasePayment } from "@/src/services/purchases/purchases";
import { purchasePaymentSchema } from "@/src/lib/validation/purchases";
import { requirePermission } from "@/src/services/auth/authorization";

export type PurchasePaymentActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createPurchasePaymentAction(
  _prevState: PurchasePaymentActionState,
  formData: FormData
): Promise<PurchasePaymentActionState> {
  await requirePermission("COMPRA_CREAR");

  const raw = {
    id_compra: formData.get("id_compra")?.toString() || "",
    fecha: formData.get("fecha")?.toString() || "",
    monto: formData.get("monto")?.toString() || "",
    forma_pago: formData.get("forma_pago")?.toString() || "Transferencia",
    referencia: formData.get("referencia")?.toString() || undefined,
    observaciones: formData.get("observaciones")?.toString() || undefined,
  };

  const parsed = purchasePaymentSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    }
    return { error: "Revise los campos ingresados.", fieldErrors };
  }

  try {
    await registerPurchasePayment(parsed.data);
  } catch (error) {
    console.error("createPurchasePaymentAction ERROR:", error);
    return { error: "No fue posible registrar el abono de compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/reportes");
  return { success: true };
}
