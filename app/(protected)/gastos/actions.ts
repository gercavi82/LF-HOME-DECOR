"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createExpense } from "@/src/services/expenses/expenses";
import { createExpenseSchema } from "@/src/lib/validation/expenses";
import { requirePermission } from "@/src/services/auth/authorization";

export type ExpenseActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  await requirePermission("GASTOS_CREAR");

  const raw = {
    fecha: formData.get("fecha")?.toString() || "",
    categoria: formData.get("categoria")?.toString() || "",
    descripcion: formData.get("descripcion")?.toString() || "",
    monto: formData.get("monto")?.toString() || "",
    beneficiario: formData.get("beneficiario")?.toString() || undefined,
    observaciones: formData.get("observaciones")?.toString() || undefined,
  };

  const parsed = createExpenseSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    }
    return { error: "Revise los campos marcados.", fieldErrors };
  }

  try {
    await createExpense(parsed.data);
  } catch (error) {
    console.error("createExpenseAction ERROR:", error);
    return { error: "No fue posible registrar el gasto." };
  }

  revalidatePath("/gastos");
  revalidatePath("/reportes");
  redirect("/gastos?created=1");
}
