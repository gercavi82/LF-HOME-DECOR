import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { gs1ValidationMessage, normalizeGs1 } from "@/src/lib/gs1";
import { roundCurrency } from "@/src/lib/tax";
import { requirePermission } from "@/src/services/auth/authorization";

const BUCKET = "productos";
const productIdSchema = z.coerce.number().int().positive();

export const productSchema = z.object({
  descripcion: z.string().trim().min(3, "Ingrese una descripción.").max(250),
  detalle: z.string().trim().max(1000).optional(),
  codigo_gs1: z.string().trim().max(50).transform(normalizeGs1).superRefine((value, context) => {
    if (!value) return;
    const message = gs1ValidationMessage(value);
    if (message) context.addIssue({ code: "custom", message });
  }),
  id_categoria: z.coerce.number().int().positive("Seleccione una categoría."),
  id_tipo: z.coerce.number().int().positive("Seleccione un tipo."),
  id_marca: z.coerce.number().int().positive("Seleccione una marca."),
  id_material: z.coerce.number().int().positive("Seleccione un material."),
  id_tamano: z.coerce.number().int().positive("Seleccione un tamaño."),
  id_color: z.coerce.number().int().positive("Seleccione un color."),
  id_diseno: z.coerce.number().int().positive("Seleccione un diseño."),
  id_unidad: z.coerce.number().int().positive("Seleccione una unidad."),
  precio_venta: z.coerce.number().positive("El precio debe ser mayor que cero.").max(999999.99).transform(roundCurrency),
  porcentaje_iva: z.coerce.number().min(0).max(100),
  stock_minimo: z.coerce.number().min(0).max(999999),
});

export type ProductInput = z.infer<typeof productSchema>;
type CatalogOption = { id: number; nombre: string };
export type ProductCatalogs = Record<"categorias" | "tipos" | "marcas" | "materiales" | "tamanos" | "colores" | "disenos" | "unidades", CatalogOption[]> & { defaultTaxRate: number };

export type ProductListItem = {
  id_producto: number;
  id_variante: number;
  descripcion: string;
  codigo_gs1: string;
  codigo_interno: string;
  categoria: string;
  marca: string;
  precio_venta: number;
  porcentaje_iva: number;
  stock_minimo: number;
  imagen_url: string | null;
  activo: boolean;
};

function cleanSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

async function readOptions(table: string, idColumn: string): Promise<CatalogOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from(table).select(`${idColumn}, nombre`).eq("activo", true).order("nombre");
  if (error) throw new Error("No fue posible cargar los catálogos de productos.");
  return (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    return { id: Number(record[idColumn]), nombre: String(record.nombre) };
  });
}

export async function getProductCatalogs(): Promise<ProductCatalogs> {
  await requirePermission("PRODUCTO_VER");
  const admin = createAdminClient();
  const [categorias, tipos, marcas, materiales, tamanos, colores, disenos, unidades, taxResult] = await Promise.all([
    readOptions("categorias", "id_categoria"), readOptions("tipos_producto", "id_tipo"), readOptions("marcas", "id_marca"),
    readOptions("materiales", "id_material"), readOptions("tamanos", "id_tamano"), readOptions("colores", "id_color"),
    readOptions("disenos", "id_diseno"), readOptions("unidades_medida", "id_unidad"),
    admin.from("parametros_sistema").select("valor").eq("codigo", "IVA_PORCENTAJE").maybeSingle(),
  ]);
  const configuredRate = Number(taxResult.data?.valor);
  const defaultTaxRate = Number.isFinite(configuredRate) && configuredRate >= 0 && configuredRate <= 100 ? configuredRate : 15;
  return { categorias, tipos, marcas, materiales, tamanos, colores, disenos, unidades, defaultTaxRate };
}

export async function listProducts(search = "") {
  await requirePermission("PRODUCTO_VER");
  const admin = createAdminClient();
  const normalized = cleanSearch(search);
  let productsQuery = admin.from("productos").select("id_producto, descripcion, id_categoria, id_marca, activo").order("descripcion").limit(50);
  if (normalized) {
    const gs1Search = normalizeGs1(normalized);
    const { data: matchingVariants } = await admin.from("variantes_producto").select("id_producto").or(`codigo_gs1.ilike.%${gs1Search}%,codigo_interno.ilike.%${normalized}%`).limit(50);
    const matchingIds = [...new Set((matchingVariants ?? []).map((variant) => variant.id_producto))];
    productsQuery = matchingIds.length
      ? productsQuery.or(`descripcion.ilike.%${normalized}%,id_producto.in.(${matchingIds.join(",")})`)
      : productsQuery.ilike("descripcion", `%${normalized}%`);
  }
  const { data: products, error } = await productsQuery;
  if (error) throw new Error("No fue posible cargar los productos.");
  const ids = (products ?? []).map((item) => item.id_producto);
  if (!ids.length) return [] as ProductListItem[];

  const [{ data: variants, error: variantsError }, catalogs] = await Promise.all([
    admin.from("variantes_producto").select("id_variante, id_producto, codigo_interno, codigo_gs1, precio_venta, porcentaje_iva, stock_minimo, imagen_url, activo").in("id_producto", ids).order("id_variante"),
    getProductCatalogs(),
  ]);
  if (variantsError) throw new Error("No fue posible cargar las variantes.");
  const firstVariant = new Map<number, (typeof variants)[number]>();
  for (const variant of variants ?? []) if (!firstVariant.has(variant.id_producto)) firstVariant.set(variant.id_producto, variant);
  const categoryNames = new Map(catalogs.categorias.map((item) => [item.id, item.nombre]));
  const brandNames = new Map(catalogs.marcas.map((item) => [item.id, item.nombre]));
  return (products ?? []).flatMap((product) => {
    const variant = firstVariant.get(product.id_producto);
    if (!variant) return [];
    return [{ id_producto: product.id_producto, id_variante: variant.id_variante, descripcion: product.descripcion, codigo_interno: variant.codigo_interno, codigo_gs1: variant.codigo_gs1 ?? "", categoria: categoryNames.get(product.id_categoria) ?? "—", marca: product.id_marca ? brandNames.get(product.id_marca) ?? "—" : "—", precio_venta: Number(variant.precio_venta), porcentaje_iva: Number(variant.porcentaje_iva), stock_minimo: Number(variant.stock_minimo), imagen_url: variant.imagen_url, activo: product.activo && variant.activo }];
  });
}

export async function getProductById(id: number | string) {
  await requirePermission("PRODUCTO_VER");
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) return null;
  const admin = createAdminClient();
  const [{ data: product, error }, { data: variant, error: variantError }] = await Promise.all([
    admin.from("productos").select("*").eq("id_producto", parsed.data).maybeSingle(),
    admin.from("variantes_producto").select("*").eq("id_producto", parsed.data).order("id_variante").limit(1).maybeSingle(),
  ]);
  if (error || variantError) throw new Error("No fue posible cargar el producto.");
  return product && variant ? { ...product, ...variant } : null;
}

async function uploadImage(file: File, productId: number) {
  if (!file.size) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen no puede superar 5 MB.");
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("No fue posible cargar la imagen.");
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function createProduct(input: ProductInput, image?: File | null) {
  const context = await requirePermission("PRODUCTO_CREAR");
  const parsed = productSchema.parse(input);
  const admin = createAdminClient();
  const { data: product, error } = await admin.from("productos").insert({ id_categoria: parsed.id_categoria, id_tipo: parsed.id_tipo, id_marca: parsed.id_marca, descripcion: parsed.descripcion, detalle: parsed.detalle || null, activo: true, creado_por: context.id_usuario }).select("id_producto").single();
  if (error || !product) throw new Error("No fue posible crear el producto.");
  let imageUrl: string | null = null;
  try {
    imageUrl = image ? await uploadImage(image, product.id_producto) : null;
    const { error: variantError } = await admin.from("variantes_producto").insert({ id_producto: product.id_producto, codigo_gs1: parsed.codigo_gs1 || null, id_material: parsed.id_material, id_tamano: parsed.id_tamano, id_color: parsed.id_color, id_diseno: parsed.id_diseno, id_unidad: parsed.id_unidad, precio_venta: parsed.precio_venta, porcentaje_iva: parsed.porcentaje_iva, stock_minimo: parsed.stock_minimo, imagen_url: imageUrl, activo: true });
    if (variantError) throw new Error(variantError.code === "23505" ? "El código GS1 ya está registrado." : "No fue posible crear la variante.");
  } catch (caught) {
    await admin.from("productos").delete().eq("id_producto", product.id_producto);
    if (imageUrl) await removeStoredImage(imageUrl);
    throw caught;
  }
  return product.id_producto;
}

function imagePath(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  return url.includes(marker) ? decodeURIComponent(url.split(marker)[1] ?? "") : null;
}

async function removeStoredImage(url: string) {
  const path = imagePath(url);
  if (path) await createAdminClient().storage.from(BUCKET).remove([path]);
}

export async function updateProduct(id: number, input: ProductInput, image?: File | null) {
  await requirePermission("PRODUCTO_EDITAR");
  const parsedId = productIdSchema.parse(id);
  const parsed = productSchema.parse(input);
  const current = await getProductById(parsedId);
  if (!current) throw new Error("Producto no encontrado.");
  const newImageUrl = image?.size ? await uploadImage(image, parsedId) : null;
  const admin = createAdminClient();
  const [{ error }, { error: variantError }] = await Promise.all([
    admin.from("productos").update({ id_categoria: parsed.id_categoria, id_tipo: parsed.id_tipo, id_marca: parsed.id_marca, descripcion: parsed.descripcion, detalle: parsed.detalle || null, fecha_actualizacion: new Date().toISOString() }).eq("id_producto", parsedId),
    admin.from("variantes_producto").update({ codigo_gs1: parsed.codigo_gs1 || null, id_material: parsed.id_material, id_tamano: parsed.id_tamano, id_color: parsed.id_color, id_diseno: parsed.id_diseno, id_unidad: parsed.id_unidad, precio_venta: parsed.precio_venta, porcentaje_iva: parsed.porcentaje_iva, stock_minimo: parsed.stock_minimo, ...(newImageUrl ? { imagen_url: newImageUrl } : {}), fecha_actualizacion: new Date().toISOString() }).eq("id_variante", current.id_variante),
  ]);
  if (error || variantError) {
    if (newImageUrl) await removeStoredImage(newImageUrl);
    throw new Error(variantError?.code === "23505" ? "El código GS1 ya está registrado." : "No fue posible actualizar el producto.");
  }
  if (newImageUrl && current.imagen_url) await removeStoredImage(current.imagen_url);
}

export async function setProductStatus(id: number, activo: boolean) {
  await requirePermission("PRODUCTO_EDITAR");
  const parsedId = productIdSchema.parse(id);
  const admin = createAdminClient();
  const [{ error }, { error: variantError }] = await Promise.all([
    admin.from("productos").update({ activo, fecha_actualizacion: new Date().toISOString() }).eq("id_producto", parsedId),
    admin.from("variantes_producto").update({ activo, fecha_actualizacion: new Date().toISOString() }).eq("id_producto", parsedId),
  ]);
  if (error || variantError) throw new Error("No fue posible cambiar el estado.");
}
