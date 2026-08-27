import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { PurchaseForm } from "@/src/components/purchases/purchase-form";
import { getPurchaseCatalogs } from "@/src/services/purchases/purchases";
import { requirePermission } from "@/src/services/auth/authorization";

export default async function NuevaCompraPage() {
  await requirePermission("COMPRA_CREAR");
  const catalogs = await getPurchaseCatalogs();

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Adquisición de mercadería"
        title="Registrar nueva compra"
        description="Ingrese los datos de la factura del proveedor y agregue los productos para sumar al inventario."
        actions={
          <Link
            href="/compras"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy"
          >
            <ArrowLeft size={17} /> Volver a compras
          </Link>
        }
      />

      <PurchaseForm catalogs={catalogs} />
    </ContentContainer>
  );
}
