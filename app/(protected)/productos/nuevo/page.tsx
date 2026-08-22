import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { ProductForm } from "@/src/components/products/product-form";
import { Card, CardContent } from "@/src/components/ui";
import { getProductCatalogs } from "@/src/services/products/products";
import { requirePermission } from "@/src/services/auth/authorization";

export default async function NewProductPage() {
  await requirePermission("PRODUCTO_CREAR");
  const catalogs = await getProductCatalogs();
  return <ContentContainer><PageHeader eyebrow="Productos" title="Nuevo producto" description="Registra la ficha principal y su primera variante." actions={<Link href="/productos" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>} /><Card><CardContent className="pt-5 sm:pt-6"><ProductForm catalogs={catalogs} /></CardContent></Card></ContentContainer>;
}
