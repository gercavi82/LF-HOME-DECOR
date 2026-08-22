import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { ProductForm } from "@/src/components/products/product-form";
import { Card, CardContent } from "@/src/components/ui";
import { getProductById, getProductCatalogs } from "@/src/services/products/products";
import { requirePermission } from "@/src/services/auth/authorization";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PRODUCTO_EDITAR");
  const { id } = await params;
  const [product, catalogs] = await Promise.all([getProductById(id), getProductCatalogs()]);
  if (!product) notFound();
  return <ContentContainer><PageHeader eyebrow="Productos" title="Editar producto" description={product.descripcion} actions={<Link href={`/productos/${id}`} className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>} /><Card><CardContent className="pt-5 sm:pt-6"><ProductForm catalogs={catalogs} defaults={product} /></CardContent></Card></ContentContainer>;
}
