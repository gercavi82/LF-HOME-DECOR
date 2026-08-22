import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { requireAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";

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

async function requireAdministrator() {
  const context = await requireAuthContext();
  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR) throw new Error("No autorizado.");
  return context;
}

export function parseCatalogKey(value: string) {
  const parsed = catalogKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listCatalogItems(key: CatalogKey) {
  await requireAdministrator();
  const definition = catalogDefinitions[key];
  const columns = [definition.id, "nombre", "activo", ...definition.fields].join(", ");
  const admin = createAdminClient();
  const { data, error } = await admin.from(definition.table).select(columns).order("nombre");
  if (error) throw new Error(`No fue posible cargar ${definition.label.toLowerCase()}.`);
  return (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
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
  await requireAdministrator();
  const definition = catalogDefinitions[key];
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  if (key === "unidades" && !parsed.data.codigo) {
    throw new Error("El código de la unidad es obligatorio.");
  }

  const payload: Record<string, string | boolean | null> = { nombre: parsed.data.nombre, activo: true };
  for (const field of definition.fields as readonly CatalogField[]) payload[field] = parsed.data[field] || null;

  const admin = createAdminClient();
  const query = id
    ? admin.from(definition.table).update(payload).eq(definition.id, id)
    : admin.from(definition.table).insert(payload);
  const { error } = await query;
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un registro con ese nombre o código.");
    throw new Error(`No fue posible guardar la ${definition.singular}.`);
  }
}

export async function setCatalogItemStatus(key: CatalogKey, id: number, activo: boolean) {
  await requireAdministrator();
  const definition = catalogDefinitions[key];
  const admin = createAdminClient();
  const { error } = await admin.from(definition.table).update({ activo }).eq(definition.id, id);
  if (error) throw new Error("No fue posible cambiar el estado.");
}

export async function deleteCatalogItem(key: CatalogKey, id: number) {
  await requireAdministrator();
  const definition = catalogDefinitions[key];
  const admin = createAdminClient();
  const { error } = await admin.from(definition.table).delete().eq(definition.id, id);
  if (error) {
    if (error.code === "23503") throw new Error("No se puede eliminar porque está siendo utilizado. Puede desactivarlo.");
    throw new Error("No fue posible eliminar el registro.");
  }
}
