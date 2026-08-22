"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { deleteCatalogItem, parseCatalogKey, saveCatalogItem, setCatalogItemStatus } from "@/src/services/catalogs/catalogs";

function destination(key: string, message: string, type: "success" | "error") {
  return `/configuracion/catalogos/${key}?${type}=${encodeURIComponent(message)}`;
}

export async function saveCatalogAction(formData: FormData) {
  const key = parseCatalogKey(String(formData.get("catalogo") ?? ""));
  if (!key) redirect("/configuracion?error=catalogo-invalido");
  const idResult = z.coerce.number().int().positive().safeParse(formData.get("id"));
  try {
    await saveCatalogItem(key, Object.fromEntries(formData), idResult.success ? idResult.data : undefined);
  } catch (error) {
    redirect(destination(key, error instanceof Error ? error.message : "No fue posible guardar.", "error"));
  }
  revalidatePath(`/configuracion/catalogos/${key}`);
  redirect(destination(key, idResult.success ? "Registro actualizado." : "Registro creado.", "success"));
}

export async function setCatalogStatusAction(formData: FormData) {
  const key = parseCatalogKey(String(formData.get("catalogo") ?? ""));
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  const activo = z.enum(["true", "false"]).safeParse(formData.get("activo"));
  if (!key || !id.success || !activo.success) redirect("/configuracion?error=datos-invalidos");
  try {
    await setCatalogItemStatus(key, id.data, activo.data === "true");
  } catch (error) {
    redirect(destination(key, error instanceof Error ? error.message : "No fue posible actualizar.", "error"));
  }
  revalidatePath(`/configuracion/catalogos/${key}`);
  redirect(destination(key, "Estado actualizado.", "success"));
}

export async function deleteCatalogAction(formData: FormData) {
  const key = parseCatalogKey(String(formData.get("catalogo") ?? ""));
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!key || !id.success) redirect("/configuracion?error=datos-invalidos");
  try {
    await deleteCatalogItem(key, id.data);
  } catch (error) {
    redirect(destination(key, error instanceof Error ? error.message : "No fue posible eliminar.", "error"));
  }
  revalidatePath(`/configuracion/catalogos/${key}`);
  redirect(destination(key, "Registro eliminado.", "success"));
}
