import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { PurchaseForm } from "@/src/components/purchases/purchase-form";
import { getPurchaseById, getPurchaseCatalogs } from "@/src/services/purchases/purchases";
import { requirePermission } from "@/src/services/auth/authorization";

export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("COMPRA_EDITAR");
  const { id } = await params;
  const purchaseId = Number(id);
  if (!purchaseId || isNaN(purchaseId)) notFound();

  const [purchase, catalogs] = await Promise.all([
    getPurchaseById(purchaseId),
    getPurchaseCatalogs(),
  ]);

  if (!purchase) notFound();

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Modificación de compra"
        title={`Editar compra ${purchase.numero_compra}`}
        description={`Proveedor: ${purchase.proveedor} · Fecha: ${purchase.fecha}`}
        actions={
          <Link
            href="/compras"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy"
          >
            <ArrowLeft size={17} /> Volver a compras
          </Link>
        }
      />

      <PurchaseForm
        catalogs={catalogs}
        defaults={{
          id_compra: purchase.id_compra,
          id_proveedor: purchase.id_proveedor,
          numero_compra: purchase.numero_compra,
          fecha: purchase.fecha,
          observaciones: purchase.observaciones,
          items: purchase.items.map((it) => ({
            id_variante: it.id_variante,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            porcentaje_iva: it.porcentaje_iva,
          })),
        }}
      />
    </ContentContainer>
  );
}
