import "server-only";

import { z } from "zod";
import { query, execute } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export const catalogDefinitions = {
  categorias: { label: "Categorías", singular: "categoría", table: "categorias", id: "id_categoria", fields: ["codigo", "descripcion"], group: "productos" },
  marcas: { label: "Marcas", singular: "marca", table: "marcas", id: "id_marca", fields: ["descripcion"], group: "productos" },
  tipos: { label: "Tipos de producto", singular: "tipo", table: "tipos_producto", id: "id_tipo", fields: ["descripcion"], group: "productos" },
  materiales: { label: "Materiales", singular: "material", table: "materiales", id: "id_material", fields: ["descripcion"], group: "productos" },
  tamanos: { label: "Tamaños", singular: "tamaño", table: "tamanos", id: "id_tamano", fields: ["descripcion"], group: "productos" },
  colores: { label: "Colores", singular: "color", table: "colores", id: "id_color", fields: ["codigo_hex"], group: "productos" },
  disenos: { label: "Diseños", singular: "diseño", table: "disenos", id: "id_diseno", fields: ["descripcion"], group: "productos" },
  unidades: { label: "Unidades de medida", singular: "unidad", table: "unidades_medida", id: "id_unidad", fields: ["codigo"], group: "productos" },
  proveedores: { label: "Proveedores", singular: "proveedor", table: "proveedores", id: "id_proveedor", fields: ["ruc_cedula", "telefono", "correo", "direccion"], group: "operaciones" },
  locales: { label: "Locales Comerciales", singular: "local", table: "locales", id: "id_local", fields: ["codigo", "direccion", "telefono"], group: "operaciones" },
  bodegas: { label: "Bodegas de Almacenamiento", singular: "bodega", table: "bodegas", id: "id_bodega", fields: ["id_local", "descripcion"], group: "operaciones" },
} as const;

export type CatalogKey = keyof typeof catalogDefinitions;
export type CatalogField = "codigo" | "descripcion" | "codigo_hex" | "ruc_cedula" | "telefono" | "correo" | "direccion" | "id_local";
export type CatalogItem = {
  id: number;
  nombre: string;
  activo: boolean;
  codigo?: string | null;
  descripcion?: string | null;
  codigo_hex?: string | null;
  ruc_cedula?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  id_local?: number | null;
  local_nombre?: string | null;
};

const catalogKeySchema = z.enum(Object.keys(catalogDefinitions) as [CatalogKey, ...CatalogKey[]]);
const itemSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(150),
  codigo: z.string().trim().max(50).optional().or(z.literal("")),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  codigo_hex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use un color hexadecimal como #C96D4D.").optional().or(z.literal("")),
  ruc_cedula: z.string().trim().max(20).optional().or(z.literal("")),
  telefono: z.string().trim().max(50).optional().or(z.literal("")),
  correo: z.string().trim().email("Ingrese un correo electrónico válido.").optional().or(z.literal("")),
  direccion: z.string().trim().max(255).optional().or(z.literal("")),
  id_local: z.coerce.number().int().positive().optional(),
});

async function requireCatalogAccess() {
  return requirePermission("CONFIGURACION_VER");
}

export function parseCatalogKey(value: string) {
  const parsed = catalogKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listLocalesOptions() {
  await requireCatalogAccess();
  return query<{ id_local: number; nombre: string }>(
    `SELECT id_local, nombre FROM locales WHERE activo = 1 ORDER BY nombre ASC`
  ).catch(() => []);
}

export async function listCatalogItems(key: CatalogKey): Promise<CatalogItem[]> {
  await requireCatalogAccess();
  const definition = catalogDefinitions[key];

  if (key === "bodegas") {
    const data = await query<Record<string, unknown>>(
      `SELECT b.id_bodega, b.nombre, b.id_local, b.descripcion, b.activo, l.nombre AS local_nombre
       FROM bodegas b
       LEFT JOIN locales l ON l.id_local = b.id_local
       ORDER BY b.nombre ASC`
    ).catch(() => []);

    return (data ?? []).map((record): CatalogItem => ({
      id: Number(record.id_bodega),
      nombre: String(record.nombre),
      activo: Boolean(record.activo),
      codigo: null,
      codigo_hex: null,
      ruc_cedula: null,
      telefono: null,
      correo: null,
      direccion: null,
      descripcion: typeof record.descripcion === "string" ? record.descripcion : null,
      id_local: record.id_local ? Number(record.id_local) : null,
      local_nombre: typeof record.local_nombre === "string" ? record.local_nombre : "Sin local asignado",
    }));
  }

  const columns = [definition.id, "nombre", "activo", ...definition.fields].map((c) => `\`${c}\``).join(", ");
  
  const data = await query<Record<string, unknown>>(
    `SELECT ${columns} FROM \`${definition.table}\` ORDER BY \`nombre\` ASC`
  ).catch(() => []);

  return (data ?? []).map((record): CatalogItem => {
    return {
      id: Number(record[definition.id]),
      nombre: String(record.nombre),
      activo: Boolean(record.activo),
      codigo: typeof record.codigo === "string" ? record.codigo : null,
      descripcion: typeof record.descripcion === "string" ? record.descripcion : null,
      codigo_hex: typeof record.codigo_hex === "string" ? record.codigo_hex : null,
      ruc_cedula: typeof record.ruc_cedula === "string" ? record.ruc_cedula : null,
      telefono: typeof record.telefono === "string" ? record.telefono : null,
      correo: typeof record.correo === "string" ? record.correo : null,
      direccion: typeof record.direccion === "string" ? record.direccion : null,
      id_local: record.id_local ? Number(record.id_local) : null,
      local_nombre: null,
    };
  });
}

export async function saveCatalogItem(key: CatalogKey, raw: Record<string, unknown>, id?: number) {
  await requireCatalogAccess();
  const definition = catalogDefinitions[key];
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  
  if (key === "unidades" && !parsed.data.codigo) {
    throw new Error("El código de la unidad es obligatorio.");
  }

  if (key === "bodegas" && !parsed.data.id_local) {
    throw new Error("Debe seleccionar el Local al que pertenece la bodega.");
  }

  if (key === "proveedores" && !parsed.data.ruc_cedula) {
    throw new Error("El RUC o Cédula del proveedor es obligatorio.");
  }

  const fieldKeys = ["nombre", "activo", ...definition.fields];
  const fieldValues: (string | number | boolean | null)[] = [parsed.data.nombre, 1];
  for (const field of definition.fields as readonly CatalogField[]) {
    if (field === "id_local") {
      fieldValues.push(parsed.data.id_local ?? null);
    } else {
      fieldValues.push(parsed.data[field] || null);
    }
  }

  try {
    if (id) {
      const updateSets = fieldKeys.map((k) => `\`${k}\` = ?`).join(", ");
      await execute(
        `UPDATE \`${definition.table}\` SET ${updateSets} WHERE \`${definition.id}\` = ?`,
        [...fieldValues, id]
      );
    } else {
      const cols = fieldKeys.map((k) => `\`${k}\``).join(", ");
      const placeholders = fieldKeys.map(() => "?").join(", ");
      await execute(
        `INSERT INTO \`${definition.table}\` (${cols}) VALUES (${placeholders})`,
        fieldValues
      );
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "ER_DUP_ENTRY") {
      throw new Error("Ya existe un registro con ese nombre, RUC o código.");
    }
    console.error("saveCatalogItem ERROR:", error);
    throw new Error(`No fue posible guardar ${definition.singular}.`);
  }
}

export async function setCatalogItemStatus(key: CatalogKey, id: number, activo: boolean) {
  await requireCatalogAccess();
  const definition = catalogDefinitions[key];
  try {
    await execute(
      `UPDATE \`${definition.table}\` SET \`activo\` = ? WHERE \`${definition.id}\` = ?`,
      [activo ? 1 : 0, id]
    );
  } catch (error) {
    console.error("setCatalogItemStatus ERROR:", error);
    throw new Error("No fue posible cambiar el estado.");
  }
}

export async function deleteCatalogItem(key: CatalogKey, id: number) {
  await requireCatalogAccess();
  const definition = catalogDefinitions[key];
  try {
    await execute(
      `DELETE FROM \`${definition.table}\` WHERE \`${definition.id}\` = ?`,
      [id]
    );
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "ER_ROW_IS_REFERENCED" || err?.code === "ER_ROW_IS_REFERENCED_2" || err?.code === "23503") {
      throw new Error("No se puede eliminar porque está siendo utilizado. Puede desactivarlo.");
    }
    console.error("deleteCatalogItem ERROR:", error);
    throw new Error("No fue posible eliminar el registro.");
  }
}
