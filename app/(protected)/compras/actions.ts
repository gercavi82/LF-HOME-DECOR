"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createPurchase, registerPurchasePayment, updatePurchase } from "@/src/services/purchases/purchases";
import { purchaseCreateSchema, purchasePaymentSchema } from "@/src/lib/validation/purchases";
import { requirePermission } from "@/src/services/auth/authorization";

export type PurchaseActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type PurchasePaymentActionState = PurchaseActionState;

export async function createPurchaseAction(
  _prevState: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  await requirePermission("COMPRA_CREAR");

  const rawItemsJson = formData.get("items_json")?.toString() || "[]";
  let parsedItems: unknown[] = [];
  try {
    parsedItems = JSON.parse(rawItemsJson);
  } catch {
    return { error: "El formato de los productos ingresados es inválido." };
  }

  const raw = {
    id_proveedor: formData.get("id_proveedor")?.toString() || "",
    numero_compra: formData.get("numero_compra")?.toString() || "",
    fecha: formData.get("fecha")?.toString() || "",
    observaciones: formData.get("observaciones")?.toString() || undefined,
    items: parsedItems,
  };

  const parsed = purchaseCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    }
    return {
      error: parsed.error.issues[0]?.message || "Revise los campos ingresados.",
      fieldErrors,
    };
  }

  try {
    await createPurchase(parsed.data);
  } catch (error) {
    console.error("createPurchaseAction ERROR:", error);
    return { error: error instanceof Error ? error.message : "No fue posible registrar la compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/reportes");
  redirect("/compras?created=1");
}

export async function updatePurchaseAction(
  _prevState: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  await requirePermission("COMPRA_EDITAR");

  const idCompra = z.coerce.number().int().positive().safeParse(formData.get("id_compra"));
  if (!idCompra.success) return { error: "Compra inválida para editar." };

  const rawItemsJson = formData.get("items_json")?.toString() || "[]";
  let parsedItems: unknown[] = [];
  try {
    parsedItems = JSON.parse(rawItemsJson);
  } catch {
    return { error: "El formato de los productos ingresados es inválido." };
  }

  const raw = {
    id_proveedor: formData.get("id_proveedor")?.toString() || "",
    numero_compra: formData.get("numero_compra")?.toString() || "",
    fecha: formData.get("fecha")?.toString() || "",
    observaciones: formData.get("observaciones")?.toString() || undefined,
    items: parsedItems,
  };

  const parsed = purchaseCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    }
    return {
      error: parsed.error.issues[0]?.message || "Revise los campos ingresados.",
      fieldErrors,
    };
  }

  try {
    await updatePurchase(idCompra.data, parsed.data);
  } catch (error) {
    console.error("updatePurchaseAction ERROR:", error);
    return { error: error instanceof Error ? error.message : "No fue posible actualizar la compra." };
  }

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/reportes");
  redirect("/compras?updated=1");
}

export async function createPurchasePaymentAction(
  _prevState: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
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
