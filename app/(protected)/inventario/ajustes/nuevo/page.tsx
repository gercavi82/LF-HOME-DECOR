import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AdjustmentForm } from "@/src/components/inventory/adjustment-form";
import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Card, CardContent } from "@/src/components/ui";
import { getAdjustmentOptions } from "@/src/services/inventory/movements";

export default async function NewAdjustmentPage() {
  const options = await getAdjustmentOptions();
  const ready = options.products.length > 0 && options.warehouses.length > 0;
  return <ContentContainer><PageHeader eyebrow="Inventario" title="Nuevo ajuste" description="Registra una corrección autorizada con motivo y responsable." actions={<Link href="/inventario" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>} />{ready ? <Card><CardContent className="pt-5 sm:pt-6"><AdjustmentForm {...options} /></CardContent></Card> : <Alert variant="warning">Necesitas al menos un producto activo y una bodega activa para registrar ajustes.</Alert>}</ContentContainer>;
}
