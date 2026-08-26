import "server-only";

import { z } from "zod";
import { query, execute } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export const catalogDefinitions = {
  categorias: { label: "Categorías", singular: "categoría", table: "categorias", id: "id_categoria", fields: ["codigo", "descripcion"] },
  marcas: { label: "Marcas", singular: "marca", table: "marcas", id: "id_marca", fields: ["descripcion"] },
  tipos: { label: "Tipos de producto", singular: "tipo", table: "tipos_producto", id: "id_tipo", fields: ["descripcion"] },
  materiales: { label: "Materiales", singular: "material", table: "materiales", id: "id_material", fields: ["descripcion"] },
  tamanos: { label: "Tamaños", singular: "tamaño", table: "tamanos", id: "id_tamano", fields: ["descripcion"] },
  colores: { label: "Colores", singular: "color", table: "colores", id: "id_color", fields: ["codigo_hex"] },
  disenos: { label: "Diseños", singular: "diseño", table: "disenos", id: "id_diseno", fields: ["descripcion"] },
  unidades: { label: "Unidades de medida", singular: "unidad", table: "unidades_medida", id: "id_unidad", fields: ["codigo"] },
} as const;

export type CatalogKey = keyof typeof catalogDefinitions;
export type CatalogField = "codigo" | "descripcion" | "codigo_hex";
export type CatalogItem = {
  id: number;
  nombre: string;
  activo: boolean;
  codigo?: string | null;
  descripcion?: string | null;
  codigo_hex?: string | null;
};

const catalogKeySchema = z.enum(Object.keys(catalogDefinitions) as [CatalogKey, ...CatalogKey[]]);
const itemSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  codigo: z.string().trim().max(20).optional(),
  descripcion: z.string().trim().max(500).optional(),
  codigo_hex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use un color hexadecimal como #C96D4D.").optional().or(z.literal("")),
});

async function requireCatalogAccess() {
  return requirePermission("CONFIGURACION_VER");
}

export function parseCatalogKey(value: string) {
  const parsed = catalogKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listCatalogItems(key: CatalogKey) {
  await requireCatalogAccess();
  const definition = catalogDefinitions[key];
  const columns = [definition.id, "nombre", "activo", ...definition.fields].map((c) => `\`${c}\``).join(", ");
  
  const data = await query<Record<string, unknown>>(
    `SELECT ${columns} FROM \`${definition.table}\` ORDER BY \`nombre\` ASC`
  );

  return (data ?? []).map((record) => {
    return {
      id: Number(record[definition.id]),
      nombre: String(record.nombre),
      activo: Boolean(record.activo),
      codigo: typeof record.codigo === "string" ? record.codigo : null,
      descripcion: typeof record.descripcion === "string" ? record.descripcion : null,
      codigo_hex: typeof record.codigo_hex === "string" ? record.codigo_hex : null,
    } satisfies CatalogItem;
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

  const fieldKeys = ["nombre", "activo", ...definition.fields];
  const fieldValues: (string | number | boolean | null)[] = [parsed.data.nombre, 1];
  for (const field of definition.fields as readonly CatalogField[]) {
    fieldValues.push(parsed.data[field] || null);
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
      throw new Error("Ya existe un registro con ese nombre o código.");
    }
    console.error("saveCatalogItem ERROR:", error);
    throw new Error(`No fue posible guardar la ${definition.singular}.`);
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
