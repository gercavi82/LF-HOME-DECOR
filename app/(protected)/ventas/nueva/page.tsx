import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { SaleWorkspace } from "@/src/components/sales/sale-workspace";
import { getSaleWorkspaceContext } from "@/src/services/sales/sales";

export default async function NewSalePage() {
  const { context, locations, products, channels, paymentMethods, customers } = await getSaleWorkspaceContext();
  return <ContentContainer><PageHeader eyebrow="Venta rápida" title="Nueva venta" description="Flujo optimizado para búsqueda, escaneo y cobro sin pasos innecesarios." actions={<Link href="/ventas" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>} /><SaleWorkspace locations={locations} products={products} channels={channels} paymentMethods={paymentMethods} customers={customers} defaultChannelCode={context.perfil === "Asesor" ? "ASESOR" : "LOCAL"} defaultLocation={context.id_local ?? locations[0]?.id_local ?? null} /></ContentContainer>;
}
