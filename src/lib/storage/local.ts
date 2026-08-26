import "server-only";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "productos");

/**
 * Guarda una imagen en el almacenamiento local del servidor (public/uploads/productos/{productId}/{uuid}.ext)
 * y devuelve la ruta relativa accesible desde la web.
 */
export async function saveLocalImage(file: File, productId: number): Promise<string | null> {
  if (!file || !file.size) return null;

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen no puede superar los 5 MB.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen válida.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const filename = `${randomUUID()}.${extension}`;
  const targetDir = join(UPLOAD_DIR, String(productId));

  await mkdir(targetDir, { recursive: true });

  const targetPath = join(targetDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, buffer);

  return `/uploads/productos/${productId}/${filename}`;
}

/**
 * Elimina una imagen del almacenamiento local si existe.
 */
export async function deleteLocalImage(publicUrl: string | null): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith("/uploads/productos/")) return;

  try {
    const relativePath = publicUrl.replace("/uploads/productos/", "");
    const fullPath = join(UPLOAD_DIR, relativePath);
    await unlink(fullPath);
  } catch (error: unknown) {
    // Si el archivo no existe, ignorar
    const err = error as { code?: string };
    if (err?.code !== "ENOENT") {
      console.error("Error al eliminar imagen local:", error);
    }
  }
}
