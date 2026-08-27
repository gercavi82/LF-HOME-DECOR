import "server-only";

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { query, queryOne, transaction, execute } from "@/src/lib/db/mysql";
import { deleteLocalImage, saveLocalImage } from "@/src/lib/storage/local";
import { requirePermission } from "@/src/services/auth/authorization";

function getLocalProductImage(productId: number, dbUrl?: string | null): string | null {
  if (dbUrl && dbUrl.trim()) return dbUrl.trim();
  try {
    const dir = join(process.cwd(), "public", "uploads", "productos", String(productId));
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|gif|svg)$/i.test(f));
      if (files.length > 0) {
        const foundUrl = `/uploads/productos/${productId}/${files[0]}`;
        execute(
          `UPDATE variantes_producto SET imagen_url = ? WHERE id_producto = ? AND (imagen_url IS NULL OR imagen_url = '')`,
          [foundUrl, productId]
        ).catch(() => null);
        return foundUrl;
      }
    }
  } catch {
    // Ignore filesystem read errors
  }
  return null;
}

export const productIdSchema = z.coerce.number().int().positive();

export const productSchema = z.object({
  id_categoria: z.coerce.number().int().positive("Seleccione una categoría"),
  id_tipo: z.coerce.number().int().positive("Seleccione un tipo"),
  id_marca: z.coerce.number().int().positive("Seleccione una marca"),
  id_material: z.coerce.number().int().positive("Seleccione un material"),
  id_tamano: z.coerce.number().int().positive("Seleccione un tamaño"),
  id_color: z.coerce.number().int().positive().default(1),
  id_diseno: z.coerce.number().int().positive().default(1),
  id_unidad: z.coerce.number().int().positive().default(1),
  descripcion: z.string().trim().max(255).optional().nullable(),
  detalle: z.string().trim().max(1000).optional().nullable(),
  codigo_interno: z.string().trim().max(50).optional().nullable(),
  codigo_gs1: z.string().trim().max(50).optional().nullable(),
  precio_venta: z.coerce.number().min(0, "El precio debe ser positivo"),
  porcentaje_iva: z.coerce.number().min(0).max(100),
  stock_minimo: z.coerce.number().int().min(0),
  cantidad_inicial: z.coerce.number().min(0).optional().default(0),
});

export type ProductInput = z.infer<typeof productSchema>;

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

export type CatalogOption = { id: number; nombre: string };

export type ProductCatalogs = {
  categorias: CatalogOption[];
  tipos: CatalogOption[];
  marcas: CatalogOption[];
  materiales: CatalogOption[];
  tamanos: CatalogOption[];
  colores: CatalogOption[];
  disenos: CatalogOption[];
  unidades: CatalogOption[];
  defaultTaxRate: number;
};

function cleanSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

function extractCodeSlug(name: string, fallback: string): string {
  if (!name) return fallback;
  const upper = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Mapeos inteligentes para Tipos de producto
  if (upper.includes("ECONOMICO") || upper.includes("ECONOMICA")) return "ECO";
  if (upper.includes("OVEJERO") || upper.includes("PLUS OVEJERO")) return "OVE";
  if (upper.includes("BRAMANTE")) return "BRA";
  if (upper.includes("ESPECIAL")) return "ESP";
  if (upper.includes("ACOLCHADO")) return "ACO";
  if (upper.includes("IMPERMEABLE")) return "IMP";
  if (upper.includes("ORTOPEDICA") || upper.includes("SILICONADA")) return "ORT";
  if (upper.includes("PLUMON") || upper.includes("PLUMÓN")) return "PLU";
  if (upper.includes("ESTANDAR") || upper.includes("ESTÁNDAR")) return "EST";
  if (upper.includes("ALGODON") || upper.includes("ALGODÓN")) return "ALG";

  // Mapeos inteligentes para Tamaños
  if (upper.includes("1 1/2") || upper.includes("1.5") || upper.includes("TWIN")) return "1.5PL";
  if (upper.includes("2 1/2") || upper.includes("2.5") || upper.includes("QUEEN")) return "2.5PL";
  if (upper.includes("2 PLAZAS") || upper.includes("FULL")) return "2PL";
  if (upper.includes("3 PLAZAS") || upper.includes("KING")) return "3PL";
  if (upper.includes("UNICA") || upper.includes("ESTANDAR")) return "STD";

  // Mapeos para Categorías
  if (upper.includes("COBERTOR")) return "COB";
  if (upper.includes("SABANA")) return "SAB";
  if (upper.includes("EDREDON")) return "EDR";
  if (upper.includes("ALMOHADA")) return "ALM";
  if (upper.includes("FUNDA")) return "FDA";
  if (upper.includes("PROTECTOR") || upper.includes("CUBRECOLCHON")) return "PRO";
  if (upper.includes("TOALLA")) return "TOA";

  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 3) || fallback;
}

async function readOptions(table: string, idColumn: string): Promise<CatalogOption[]> {
  const rows = await query<{ id: number; nombre: string }>(
    `SELECT \`${idColumn}\` AS id, \`nombre\` 
     FROM \`${table}\` 
     WHERE \`activo\` = 1 
     ORDER BY \`nombre\` ASC`
  ).catch(() => []);

  return (rows ?? []).map((row) => ({
    id: Number(row.id),
    nombre: String(row.nombre).trim(),
  }));
}

export async function getProductCatalogs(): Promise<ProductCatalogs> {
  await requirePermission("PRODUCTO_VER");

  const [categorias, tipos, marcas, materiales, tamanos, colores, disenos, unidades, taxRow] =
    await Promise.all([
      readOptions("categorias", "id_categoria"),
      readOptions("tipos_producto", "id_tipo"),
      readOptions("marcas", "id_marca"),
      readOptions("materiales", "id_material"),
      readOptions("tamanos", "id_tamano"),
      readOptions("colores", "id_color"),
      readOptions("disenos", "id_diseno"),
      readOptions("unidades_medida", "id_unidad"),
      queryOne<{ valor: string }>(
        `SELECT valor FROM parametros_sistema WHERE codigo = 'IVA_PORCENTAJE' LIMIT 1`
      ),
    ]);

  const configuredRate = Number(taxRow?.valor);
  const defaultTaxRate =
    Number.isFinite(configuredRate) && configuredRate >= 0 && configuredRate <= 100
      ? configuredRate
      : 15;

  return {
    categorias,
    tipos,
    marcas,
    materiales,
    tamanos,
    colores,
    disenos,
    unidades,
    defaultTaxRate,
  };
}

type ProductListRowRaw = {
  id_producto: number;
  id_variante: number;
  descripcion: string;
  codigo_gs1: string | null;
  codigo_interno: string | null;
  categoria: string | null;
  marca: string | null;
  precio_venta: number;
  porcentaje_iva: number;
  stock_minimo: number;
  imagen_url: string | null;
  activo: number | boolean;
};

export async function listProducts(search = ""): Promise<ProductListItem[]> {
  await requirePermission("PRODUCTO_VER");
  const normalized = cleanSearch(search);

  let sql = `
    SELECT 
      p.id_producto,
      vp.id_variante,
      p.descripcion,
      COALESCE(vp.codigo_gs1, '') AS codigo_gs1,
      COALESCE(vp.codigo_interno, '') AS codigo_interno,
      COALESCE(c.nombre, '—') AS categoria,
      COALESCE(m.nombre, '—') AS marca,
      vp.precio_venta,
      vp.porcentaje_iva,
      vp.stock_minimo,
      vp.imagen_url,
      (p.activo = 1 AND vp.activo = 1) AS activo
    FROM productos p
    JOIN variantes_producto vp ON vp.id_producto = p.id_producto
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN marcas m ON m.id_marca = p.id_marca
  `;

  const params: unknown[] = [];

  if (normalized) {
    sql += `
      WHERE (
        p.descripcion LIKE ? 
        OR vp.codigo_gs1 LIKE ? 
        OR vp.codigo_interno LIKE ?
      )
    `;
    const pattern = `%${normalized}%`;
    params.push(pattern, pattern, pattern);
  }

  sql += ` ORDER BY p.descripcion ASC LIMIT 50`;

  try {
    const rows = await query<ProductListRowRaw>(sql, params);

    return (rows ?? []).map((row) => ({
      id_producto: Number(row.id_producto),
      id_variante: Number(row.id_variante),
      descripcion: row.descripcion,
      codigo_gs1: row.codigo_gs1 || "",
      codigo_interno: row.codigo_interno || "",
      categoria: row.categoria || "—",
      marca: row.marca || "—",
      precio_venta: Number(row.precio_venta) || 0,
      porcentaje_iva: Number(row.porcentaje_iva) || 0,
      stock_minimo: Number(row.stock_minimo) || 0,
      imagen_url: getLocalProductImage(Number(row.id_producto), row.imagen_url),
      activo: Boolean(row.activo),
    }));
  } catch (error) {
    console.error("MySQL listProducts ERROR:", error);
    throw new Error("No fue posible cargar los productos.");
  }
}

type ProductDetailRowRaw = {
  id_producto: number;
  id_categoria: number;
  id_tipo: number;
  id_marca: number;
  descripcion: string;
  detalle: string | null;
  producto_activo: number | boolean;
  id_variante: number;
  codigo_interno: string;
  codigo_gs1: string | null;
  id_material: number;
  id_tamano: number;
  id_color: number;
  id_diseno: number;
  id_unidad: number;
  precio_venta: number;
  porcentaje_iva: number;
  stock_minimo: number;
  imagen_url: string | null;
  variante_activa: number | boolean;
  categoria: string | null;
  tipo: string | null;
  marca: string | null;
  material: string | null;
  tamano: string | null;
  color: string | null;
  diseno: string | null;
  unidad: string | null;
};

export async function getProductById(id: number | string) {
  await requirePermission("PRODUCTO_VER");
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) return null;

  try {
    const row = await queryOne<ProductDetailRowRaw>(
      `SELECT 
         p.id_producto,
         p.id_categoria,
         p.id_tipo,
         p.id_marca,
         p.descripcion,
         p.detalle,
         p.activo AS producto_activo,
         vp.id_variante,
         vp.codigo_interno,
         vp.codigo_gs1,
         vp.id_material,
         vp.id_tamano,
         vp.id_color,
         vp.id_diseno,
         vp.id_unidad,
         vp.precio_venta,
         vp.porcentaje_iva,
         vp.stock_minimo,
         vp.imagen_url,
         vp.activo AS variante_activa,
         c.nombre AS categoria,
         tp.nombre AS tipo,
         m.nombre AS marca,
         mat.nombre AS material,
         tam.nombre AS tamano,
         col.nombre AS color,
         dis.nombre AS diseno,
         uni.nombre AS unidad
       FROM productos p
       JOIN variantes_producto vp ON vp.id_producto = p.id_producto
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       LEFT JOIN tipos_producto tp ON tp.id_tipo = p.id_tipo
       LEFT JOIN marcas m ON m.id_marca = p.id_marca
       LEFT JOIN materiales mat ON mat.id_material = vp.id_material
       LEFT JOIN tamanos tam ON tam.id_tamano = vp.id_tamano
       LEFT JOIN colores col ON col.id_color = vp.id_color
       LEFT JOIN disenos dis ON dis.id_diseno = vp.id_diseno
       LEFT JOIN unidades_medida uni ON uni.id_unidad = vp.id_unidad
       WHERE p.id_producto = ?
       LIMIT 1`,
      [parsed.data]
    );

    if (!row) return null;

    return {
      id_producto: Number(row.id_producto),
      id_categoria: Number(row.id_categoria),
      id_tipo: Number(row.id_tipo),
      id_marca: Number(row.id_marca),
      descripcion: row.descripcion,
      detalle: row.detalle,
      activo: Boolean(row.producto_activo && row.variante_activa),
      producto_activo: Boolean(row.producto_activo),
      id_variante: Number(row.id_variante),
      codigo_interno: row.codigo_interno,
      codigo_gs1: row.codigo_gs1,
      id_material: Number(row.id_material),
      id_tamano: Number(row.id_tamano),
      id_color: Number(row.id_color),
      id_diseno: Number(row.id_diseno),
      id_unidad: Number(row.id_unidad),
      precio_venta: Number(row.precio_venta),
      porcentaje_iva: Number(row.porcentaje_iva),
      stock_minimo: Number(row.stock_minimo),
      imagen_url: getLocalProductImage(Number(row.id_producto), row.imagen_url),
      variante_activa: Boolean(row.variante_activa),
      categoria: row.categoria,
      tipo: row.tipo,
      marca: row.marca,
      material: row.material,
      tamano: row.tamano,
      color: row.color,
      diseno: row.diseno,
      unidad: row.unidad,
    };
  } catch (error) {
    console.error("MySQL getProductById ERROR:", error);
    throw new Error("No fue posible cargar el producto.");
  }
}

export async function createProduct(input: ProductInput, image?: File | null): Promise<number> {
  const context = await requirePermission("PRODUCTO_CREAR");
  const parsed = productSchema.parse(input);

  return transaction(async (conn) => {
    // Generar descripción automática si no se especificó
    let finalDesc = parsed.descripcion?.trim();
    if (!finalDesc) {
      const [names] = await conn.execute<RowDataPacket[]>(
        `SELECT 
           (SELECT nombre FROM categorias WHERE id_categoria = ?) AS cat_name,
           (SELECT nombre FROM tipos_producto WHERE id_tipo = ?) AS tipo_name,
           (SELECT nombre FROM tamanos WHERE id_tamano = ?) AS tamano_name`,
        [parsed.id_categoria, parsed.id_tipo, parsed.id_tamano]
      );
      const row = names?.[0] as { cat_name?: string; tipo_name?: string; tamano_name?: string };
      const parts = [row?.tipo_name || row?.cat_name || "Producto", row?.tamano_name].filter(Boolean);
      finalDesc = parts.join(" ");
    }

    // 1. Insertar producto
    const [prodRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO productos (
         id_categoria,
         id_tipo,
         id_marca,
         descripcion,
         detalle,
         activo,
         creado_por,
         fecha_creacion
       ) VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
      [
        parsed.id_categoria,
        parsed.id_tipo,
        parsed.id_marca,
        finalDesc,
        parsed.detalle || null,
        context.id_usuario,
      ]
    );

    const productId = Number(prodRes.insertId);

    // 2. Generar código interno estructurado (Ej: MHC-COB-ECO-2PL-006)
    let codigoInterno = parsed.codigo_interno?.trim();
    if (!codigoInterno) {
      const [metaRows] = await conn.execute<RowDataPacket[]>(
        `SELECT 
           (SELECT codigo FROM categorias WHERE id_categoria = ?) AS cat_codigo,
           (SELECT nombre FROM categorias WHERE id_categoria = ?) AS cat_nombre,
           (SELECT nombre FROM tipos_producto WHERE id_tipo = ?) AS tipo_nombre,
           (SELECT nombre FROM tamanos WHERE id_tamano = ?) AS tamano_nombre`,
        [parsed.id_categoria, parsed.id_categoria, parsed.id_tipo, parsed.id_tamano]
      );
      const meta = metaRows?.[0] as {
        cat_codigo?: string;
        cat_nombre?: string;
        tipo_nombre?: string;
        tamano_nombre?: string;
      };

      const catSlug = meta?.cat_codigo?.trim() || extractCodeSlug(meta?.cat_nombre || "", "COB");
      const tipoSlug = extractCodeSlug(meta?.tipo_nombre || "", "ECO");
      const tamSlug = extractCodeSlug(meta?.tamano_nombre || "", "2PL");

      const [countRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM variantes_producto WHERE codigo_interno LIKE ?`,
        [`MHC-${catSlug}-${tipoSlug}-${tamSlug}-%`]
      );
      const nextNum = Number(countRows?.[0]?.total || 0) + 1;
      const seq = String(nextNum).padStart(3, "0");

      codigoInterno = `MHC-${catSlug}-${tipoSlug}-${tamSlug}-${seq}`;
    }

    // 3. Guardar imagen si existe
    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      imageUrl = await saveLocalImage(image, productId);
    }

    // 4. Insertar variante de producto
    try {
      await conn.execute(
        `INSERT INTO variantes_producto (
           id_producto,
           codigo_interno,
           codigo_gs1,
           id_material,
           id_tamano,
           id_color,
           id_diseno,
           id_unidad,
           precio_venta,
           porcentaje_iva,
           stock_minimo,
           imagen_url,
           activo,
           fecha_creacion
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [
          productId,
          codigoInterno,
          parsed.codigo_gs1 || null,
          parsed.id_material,
          parsed.id_tamano,
          parsed.id_color || 1,
          parsed.id_diseno || 1,
          parsed.id_unidad || 1,
          parsed.precio_venta,
          parsed.porcentaje_iva,
          parsed.stock_minimo,
          imageUrl,
        ]
      );

      // 5. Stock inicial en bodega si se especificó
      if (parsed.cantidad_inicial && parsed.cantidad_inicial > 0) {
        await conn.execute(
          `INSERT INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
           VALUES ((SELECT id_variante FROM variantes_producto WHERE id_producto = ? LIMIT 1), 1, ?, NOW())
           ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)`,
          [productId, parsed.cantidad_inicial]
        );
      }
    } catch (error: unknown) {
      if (imageUrl) await deleteLocalImage(imageUrl);
      const err = error as { code?: string };
      if (err?.code === "ER_DUP_ENTRY") {
        throw new Error("El código GS1 ya está registrado.");
      }
      throw error;
    }

    return productId;
  });
}

export async function updateProduct(id: number, input: ProductInput, image?: File | null): Promise<void> {
  await requirePermission("PRODUCTO_EDITAR");
  const parsedId = productIdSchema.parse(id);
  const parsed = productSchema.parse(input);

  const current = await getProductById(parsedId);
  if (!current) throw new Error("Producto no encontrado.");

  let newImageUrl: string | null = null;
  if (image && image.size > 0) {
    newImageUrl = await saveLocalImage(image, parsedId);
  }

  await transaction(async (conn) => {
    let finalDesc = parsed.descripcion?.trim();
    if (!finalDesc) {
      const [names] = await conn.execute<RowDataPacket[]>(
        `SELECT 
           (SELECT nombre FROM categorias WHERE id_categoria = ?) AS cat_name,
           (SELECT nombre FROM tipos_producto WHERE id_tipo = ?) AS tipo_name,
           (SELECT nombre FROM tamanos WHERE id_tamano = ?) AS tamano_name`,
        [parsed.id_categoria, parsed.id_tipo, parsed.id_tamano]
      );
      const row = names?.[0] as { cat_name?: string; tipo_name?: string; tamano_name?: string };
      const parts = [row?.tipo_name || row?.cat_name || "Producto", row?.tamano_name].filter(Boolean);
      finalDesc = parts.join(" ");
    }

    // 1. Actualizar producto
    await conn.execute(
      `UPDATE productos 
       SET id_categoria = ?, 
           id_tipo = ?, 
           id_marca = ?, 
           descripcion = ?, 
           detalle = ?, 
           fecha_actualizacion = NOW() 
       WHERE id_producto = ?`,
      [
        parsed.id_categoria,
        parsed.id_tipo,
        parsed.id_marca,
        finalDesc,
        parsed.detalle || null,
        parsedId,
      ]
    );

    // 2. Actualizar variante
    const variantSql = newImageUrl
      ? `UPDATE variantes_producto 
         SET codigo_gs1 = ?, 
             id_material = ?, 
             id_tamano = ?, 
             id_color = ?, 
             id_diseno = ?, 
             id_unidad = ?, 
             precio_venta = ?, 
             porcentaje_iva = ?, 
             stock_minimo = ?, 
             imagen_url = ?, 
             fecha_actualizacion = NOW() 
         WHERE id_variante = ?`
      : `UPDATE variantes_producto 
         SET codigo_gs1 = ?, 
             id_material = ?, 
             id_tamano = ?, 
             id_color = ?, 
             id_diseno = ?, 
             id_unidad = ?, 
             precio_venta = ?, 
             porcentaje_iva = ?, 
             stock_minimo = ?, 
             fecha_actualizacion = NOW() 
         WHERE id_variante = ?`;

    const variantParams = newImageUrl
      ? [
          parsed.codigo_gs1 || null,
          parsed.id_material,
          parsed.id_tamano,
          parsed.id_color,
          parsed.id_diseno,
          parsed.id_unidad,
          parsed.precio_venta,
          parsed.porcentaje_iva,
          parsed.stock_minimo,
          newImageUrl,
          current.id_variante,
        ]
      : [
          parsed.codigo_gs1 || null,
          parsed.id_material,
          parsed.id_tamano,
          parsed.id_color,
          parsed.id_diseno,
          parsed.id_unidad,
          parsed.precio_venta,
          parsed.porcentaje_iva,
          parsed.stock_minimo,
          current.id_variante,
        ];

    try {
      await conn.execute(variantSql, variantParams);

    if (parsed.codigo_interno && parsed.codigo_interno.trim().length > 0) {
      await conn.execute(
        `UPDATE variantes_producto SET codigo_interno = ? WHERE id_variante = ?`,
        [parsed.codigo_interno.trim(), current.id_variante]
      );
    }
    } catch (error: unknown) {
      if (newImageUrl) await deleteLocalImage(newImageUrl);
      const err = error as { code?: string };
      if (err?.code === "ER_DUP_ENTRY") {
        throw new Error("El código GS1 ya está registrado.");
      }
      throw error;
    }

    if (newImageUrl && current.imagen_url) {
      await deleteLocalImage(current.imagen_url);
    }
  });
}

export async function setProductStatus(id: number, activo: boolean): Promise<void> {
  await requirePermission("PRODUCTO_EDITAR");
  const parsedId = productIdSchema.parse(id);

  await transaction(async (conn) => {
    const statusVal = activo ? 1 : 0;
    await conn.execute(
      `UPDATE productos SET activo = ?, fecha_actualizacion = NOW() WHERE id_producto = ?`,
      [statusVal, parsedId]
    );
    await conn.execute(
      `UPDATE variantes_producto SET activo = ?, fecha_actualizacion = NOW() WHERE id_producto = ?`,
      [statusVal, parsedId]
    );
  });
}
