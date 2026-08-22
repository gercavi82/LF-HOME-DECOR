import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentContainer } from "@/src/components/layout";
import { PrintReceiptButton } from "@/src/components/sales/print-receipt-button";
import { Alert, Badge } from "@/src/components/ui";
import { getSaleReceipt } from "@/src/services/sales/sales";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "long", timeStyle: "short" });

export default async function SaleReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const receipt = await getSaleReceipt(Number(id));
  if (!receipt) notFound();

  return <ContentContainer className="max-w-4xl">
    {created ? <Alert variant="success" className="no-print mb-5">Venta registrada correctamente. El comprobante está listo.</Alert> : null}
    <div className="no-print mb-5 flex flex-wrap justify-between gap-3"><Link href="/ventas" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver a ventas</Link><PrintReceiptButton /></div>
    <article className="sale-receipt mx-auto overflow-hidden rounded-2xl border bg-white shadow-[var(--lf-shadow-md)]">
      <header className="border-b-2 border-lf-navy px-4 py-6 text-center sm:px-10 sm:py-7"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-lf-terracotta">Comprobante interno</p><h1 className="mt-2 text-2xl font-bold tracking-wide text-lf-navy">L&amp;F HOME DECOR</h1><p className="mt-3 font-mono text-sm font-semibold">Venta N.º {receipt.numero_venta}</p></header>
      <div className="grid gap-4 border-b px-4 py-5 text-sm sm:grid-cols-2 sm:px-10"><dl className="space-y-2"><div className="flex gap-2"><dt className="font-semibold">Fecha:</dt><dd>{dateFormatter.format(new Date(receipt.fecha))}</dd></div><div className="flex gap-2"><dt className="font-semibold">Cliente:</dt><dd>{receipt.cliente}</dd></div>{receipt.identificacion ? <div className="flex gap-2"><dt className="font-semibold">Identificación:</dt><dd>{receipt.identificacion}</dd></div> : null}</dl><dl className="space-y-2 sm:text-right"><div><dt className="inline font-semibold">Local: </dt><dd className="inline">{receipt.local}</dd></div><div><dt className="inline font-semibold">Vendedor: </dt><dd className="inline">{receipt.vendedor}</dd></div><div><dt className="inline font-semibold">Canal: </dt><dd className="inline">{receipt.canal}</dd></div></dl></div>
      <div className="overflow-x-auto px-4 py-5 sm:px-10"><table className="w-full min-w-[620px] border-collapse text-sm"><thead><tr className="border-b-2 border-lf-navy text-left"><th className="py-2 pr-3">Producto</th><th className="px-2 py-2 text-right">Cantidad</th><th className="px-2 py-2 text-right">Precio</th><th className="px-2 py-2 text-right">Subtotal</th><th className="px-2 py-2 text-right">IVA</th><th className="py-2 pl-2 text-right">Total</th></tr></thead><tbody>{receipt.items.map((item) => <tr key={item.id_detalle} className="border-b"><td className="py-3 pr-3"><p className="font-medium">{item.producto}</p><p className="font-mono text-xs text-lf-muted">{item.codigo_gs1}</p></td><td className="px-2 py-3 text-right">{item.cantidad}</td><td className="px-2 py-3 text-right">{currency.format(item.precio_unitario)}</td><td className="px-2 py-3 text-right">{currency.format(item.subtotal)}</td><td className="px-2 py-3 text-right">{currency.format(item.iva)}</td><td className="py-3 pl-2 text-right font-semibold">{currency.format(item.total)}</td></tr>)}</tbody></table></div>
      <div className="grid gap-6 border-t bg-lf-surface-muted/40 px-4 py-5 sm:py-6 sm:grid-cols-2 sm:px-10"><section><h2 className="text-sm font-bold uppercase tracking-wide">Forma de pago</h2><div className="mt-3 space-y-2">{receipt.pagos.map((payment) => <div key={payment.id_pago} className="flex justify-between gap-3 text-sm"><span>{payment.forma}{payment.referencia ? <small className="block text-lf-muted">Ref. {payment.referencia}</small> : null}</span><strong>{currency.format(payment.valor)}</strong></div>)}</div></section><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{currency.format(receipt.subtotal)}</dd></div>{receipt.descuento > 0 ? <div className="flex justify-between"><dt>Descuento</dt><dd>−{currency.format(receipt.descuento)}</dd></div> : null}<div className="flex justify-between"><dt>IVA</dt><dd>{currency.format(receipt.iva)}</dd></div><div className="flex justify-between border-t-2 border-lf-navy pt-3 text-xl font-bold"><dt>Total</dt><dd>{currency.format(receipt.total)}</dd></div></dl></div>
      <footer className="flex flex-col gap-2 px-4 py-4 text-xs min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between text-lf-muted sm:px-10"><span>Documento interno, no constituye factura.</span><Badge variant={receipt.estado === "REGISTRADA" ? "success" : receipt.estado === "ANULADA" ? "danger" : "neutral"}>{receipt.estado}</Badge></footer>
    </article>
  </ContentContainer>;
}

