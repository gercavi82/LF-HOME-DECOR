"use server";

import { revalidatePath } from "next/cache";
import { registerCommissionPayment } from "@/src/services/commissions/commissions";
import { commissionPaymentSchema } from "@/src/lib/validation/commissions";
import { requirePermission } from "@/src/services/auth/authorization";

export type CommissionPaymentActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createCommissionPaymentAction(
  _prevState: CommissionPaymentActionState,
  formData: FormData
): Promise<CommissionPaymentActionState> {
  await requirePermission("COMISIONES_PAGAR");

  const raw = {
    id_usuario: formData.get("id_usuario")?.toString() || "",
    fecha: formData.get("fecha")?.toString() || "",
    monto: formData.get("monto")?.toString() || "",
    forma_pago: formData.get("forma_pago")?.toString() || "Transferencia",
    referencia: formData.get("referencia")?.toString() || undefined,
    observaciones: formData.get("observaciones")?.toString() || undefined,
  };

  const parsed = commissionPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    }
    return { error: "Revise los campos ingresados.", fieldErrors };
  }

  try {
    await registerCommissionPayment(parsed.data);
  } catch (error) {
    console.error("createCommissionPaymentAction ERROR:", error);
    return { error: "No fue posible registrar el pago de comisión." };
  }

  revalidatePath("/reportes");
  revalidatePath("/ventas");
  return { success: true };
}
