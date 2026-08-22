import { Eye, ImageOff, PackageSearch, Plus, Search } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent } from "@/src/components/ui";
import { listProducts } from "@/src/services/products/products";
import { getAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [products, context] = await Promise.all([listProducts(q), getAuthContext()]);
  const canCreate = context?.perfil === ROLE_NAMES.ADMINISTRADOR || context?.permisos.some((permission) => permission.codigo === "PRODUCTO_CREAR");
  return <ContentContainer>
    <PageHeader eyebrow="Catálogo" title="Productos" description="Administra fichas, códigos internos, GS1 oficiales, variantes y precios." actions={canCreate ? <Link href="/productos/nuevo" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Plus size={18} /> Nuevo producto</Link> : undefined} />
    <form className="mb-5 flex gap-3 rounded-2xl border bg-lf-surface p-3"><label className="relative flex-1"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" /><input name="q" defaultValue={q} placeholder="Buscar por descripción, código interno o GS1..." className="h-11 w-full rounded-xl border bg-white pl-10 pr-4 outline-none focus:border-lf-terracotta" /></label><button className="rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white">Buscar</button></form>
    {products.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <Card key={product.id_producto} className="overflow-hidden"><div className="grid h-44 place-items-center bg-lf-surface-muted bg-cover bg-center" style={product.imagen_url ? { backgroundImage: `url("${product.imagen_url}")` } : undefined}>{product.imagen_url ? null : <ImageOff className="text-lf-muted" />}</div><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{product.descripcion}</h2><p className="mt-1 font-mono text-xs text-lf-muted">{product.codigo_interno}</p>{product.codigo_gs1 ? <p className="font-mono text-xs text-lf-muted">GS1 {product.codigo_gs1}</p> : null}</div><Badge variant={product.activo ? "success" : "neutral"}>{product.activo ? "Activo" : "Inactivo"}</Badge></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xs text-lf-muted">{product.categoria} · {product.marca}</p><p className="mt-1 text-xl font-bold text-lf-terracotta">${product.precio_venta.toFixed(2)}</p></div><Link href={`/productos/${product.id_producto}`} className="grid size-10 place-items-center rounded-xl border hover:bg-lf-surface-muted" aria-label={`Ver ${product.descripcion}`}><Eye size={18} /></Link></div></CardContent></Card>)}</div> : <Card><CardContent className="grid min-h-64 place-items-center text-center"><div><PackageSearch className="mx-auto text-lf-terracotta" size={32} /><p className="mt-3 font-semibold">No se encontraron productos</p><p className="mt-1 text-sm text-lf-muted">Crea un producto o cambia la búsqueda.</p></div></CardContent></Card>}
  </ContentContainer>;
}

