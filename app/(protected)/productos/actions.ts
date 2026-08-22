"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createProduct, productSchema, setProductStatus, updateProduct } from "@/src/services/products/products";

export type ProductActionState = { error?: string };

function inputFrom(formData: FormData) {
  return productSchema.safeParse(Object.fromEntries(formData));
}

export async function createProductAction(_state: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const parsed = inputFrom(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const imageValue = formData.get("imagen");
  const image = imageValue instanceof File && imageValue.size ? imageValue : null;
  let id: number;
  try { id = await createProduct(parsed.data, image); }
  catch (error) { return { error: error instanceof Error ? error.message : "No fue posible crear el producto." }; }
  revalidatePath("/productos");
  redirect(`/productos/${id}?created=1`);
}

export async function updateProductAction(_state: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const id = z.coerce.number().int().positive().safeParse(formData.get("id_producto"));
  const parsed = inputFrom(formData);
  if (!id.success || !parsed.success) return { error: parsed.success ? "Producto inválido." : parsed.error.issues[0]?.message };
  const imageValue = formData.get("imagen");
  const image = imageValue instanceof File && imageValue.size ? imageValue : null;
  try { await updateProduct(id.data, parsed.data, image); }
  catch (error) { return { error: error instanceof Error ? error.message : "No fue posible actualizar." }; }
  revalidatePath("/productos"); revalidatePath(`/productos/${id.data}`);
  redirect(`/productos/${id.data}?updated=1`);
}

export async function setProductStatusAction(formData: FormData) {
  const id = z.coerce.number().int().positive().safeParse(formData.get("id_producto"));
  const activo = z.enum(["true", "false"]).safeParse(formData.get("activo"));
  if (!id.success || !activo.success) redirect("/productos?error=datos-invalidos");
  try { await setProductStatus(id.data, activo.data === "true"); }
  catch { redirect(`/productos/${id.data}?error=estado`); }
  revalidatePath("/productos"); revalidatePath(`/productos/${id.data}`);
  redirect(`/productos/${id.data}?status=1`);
}
