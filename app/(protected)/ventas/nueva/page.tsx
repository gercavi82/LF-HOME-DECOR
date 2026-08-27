import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { SaleWorkspace } from "@/src/components/sales/sale-workspace";
import { getSaleWorkspaceContext } from "@/src/services/sales/sales";

export default async function NewSalePage() {
  const { context, locations, products, channels, paymentMethods, customers } =
    await getSaleWorkspaceContext();

  const safeLocations = locations?.length ? locations : [{ id_local: 1, nombre: "Local Matriz" }];
  const safeChannels = channels?.length
    ? channels
    : [
        { id_canal: 1, nombre: "Venta Local Matriz", codigo: "LOCAL" },
        { id_canal: 2, nombre: "Venta Asesor", codigo: "ASESOR" },
      ];
  const safePaymentMethods = paymentMethods?.length
    ? paymentMethods
    : [
        { id_forma_pago: 1, nombre: "Efectivo", codigo: "EFECTIVO", requiere_referencia: false },
        { id_forma_pago: 2, nombre: "Transferencia", codigo: "TRANSFERENCIA", requiere_referencia: true },
      ];
  const safeCustomers = customers?.length
    ? customers
    : [
        { id_cliente: 1, identificacion: "9999999999999", nombre: "Consumidor Final", name: "Consumidor Final" },
      ];

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Venta rápida"
        title="Nueva venta"
        description="Flujo optimizado para búsqueda, escaneo y cobro sin pasos innecesarios."
        actions={
          <Link
            href="/ventas"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy hover:bg-lf-surface-muted transition"
          >
            <ArrowLeft size={17} /> Volver
          </Link>
        }
      />
      <SaleWorkspace
        locations={safeLocations}
        products={products ?? []}
        channels={safeChannels}
        paymentMethods={safePaymentMethods}
        customers={safeCustomers}
        defaultChannelCode={context?.perfil === "Asesor" ? "ASESOR" : "LOCAL"}
        defaultLocation={context?.id_local ?? safeLocations[0]?.id_local ?? 1}
      />
    </ContentContainer>
  );
}
