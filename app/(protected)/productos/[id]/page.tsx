import { ArrowLeft, ImageOff, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setProductStatusAction } from "@/app/(protected)/productos/actions";
import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent } from "@/src/components/ui";
import { getProductById, getProductCatalogs } from "@/src/services/products/products";
import { getAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";
import { calculateIncludedTax } from "@/src/lib/tax";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; updated?: string; status?: string; error?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const [product, catalogs, context] = await Promise.all([getProductById(id), getProductCatalogs(), getAuthContext()]);
  if (!product) notFound();
  const canEdit = context?.perfil === ROLE_NAMES.ADMINISTRADOR || context?.permisos.some((permission) => permission.codigo === "PRODUCTO_EDITAR");
  const name = (items: Array<{ id: number; nombre: string }>, value: number | null) => items.find((item) => item.id === value)?.nombre ?? "—";
  const price = Number(product.precio_venta); const tax = Number(product.porcentaje_iva); const breakdown = calculateIncludedTax(price, tax);
  return <ContentContainer>
    <PageHeader eyebrow="Productos" title={product.descripcion} description={`Código interno: ${product.codigo_interno}${product.codigo_gs1 ? ` · GS1: ${product.codigo_gs1}` : ""}`} actions={<div className="flex gap-2"><Link href="/productos" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>{canEdit ? <Link href={`/productos/${id}/editar`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white"><Pencil size={17} /> Editar</Link> : null}</div>} />
    {query.created ? <Alert variant="success" className="mb-5">Producto creado correctamente.</Alert> : null}{query.updated ? <Alert variant="success" className="mb-5">Producto actualizado correctamente.</Alert> : null}{query.status ? <Alert variant="success" className="mb-5">Estado actualizado.</Alert> : null}{query.error ? <Alert variant="danger" className="mb-5">No fue posible actualizar el estado.</Alert> : null}
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]"><Card className="overflow-hidden"><div className="grid aspect-square place-items-center bg-lf-surface-muted bg-contain bg-center bg-no-repeat" style={product.imagen_url ? { backgroundImage: `url("${product.imagen_url}")` } : undefined}>{product.imagen_url ? null : <ImageOff size={36} className="text-lf-muted" />}</div></Card><Card><CardContent className="pt-5 sm:pt-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Ficha del producto</h2><Badge variant={product.activo ? "success" : "neutral"}>{product.activo ? "Activo" : "Inactivo"}</Badge></div><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[
      ["Código interno", product.codigo_interno], ["Código GS1", product.codigo_gs1 || "No asignado"], ["Categoría", name(catalogs.categorias, product.id_categoria)], ["Tipo", name(catalogs.tipos, product.id_tipo)], ["Marca", name(catalogs.marcas, product.id_marca)], ["Material", name(catalogs.materiales, product.id_material)], ["Tamaño", name(catalogs.tamanos, product.id_tamano)], ["Color", name(catalogs.colores, product.id_color)], ["Diseño", name(catalogs.disenos, product.id_diseno)], ["Unidad", name(catalogs.unidades, product.id_unidad)], ["Total incluido IVA", `$${breakdown.total.toFixed(2)}`], ["Subtotal sin IVA", `$${breakdown.subtotal.toFixed(2)}`], ["IVA", `${tax.toFixed(2)}% · $${breakdown.tax.toFixed(2)}`], ["Stock mínimo", String(product.stock_minimo)],
    ].map(([label, value]) => <div key={label} className="rounded-xl bg-lf-surface-muted p-3"><dt className="text-xs text-lf-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>{product.detalle ? <div className="mt-4"><p className="text-xs text-lf-muted">Detalle</p><p className="mt-1 text-sm leading-6">{product.detalle}</p></div> : null}{canEdit ? <form action={setProductStatusAction} className="mt-5 border-t pt-5"><input type="hidden" name="id_producto" value={product.id_producto} /><input type="hidden" name="activo" value={String(!product.activo)} /><button className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-lf-surface-muted">{product.activo ? "Desactivar producto" : "Activar producto"}</button></form> : null}</CardContent></Card></div>
  </ContentContainer>;
}

