import { Eye, FilterX, Search } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { getSaleHistory } from "@/src/services/sales/sales";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" });
type Params = { desde?: string; hasta?: string; vendedor?: string; canal?: string; pago?: string; numero?: string };

export default async function SaleHistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { sales, sellers, channels, paymentMethods } = await getSaleHistory({ from: params.desde, to: params.hasta, seller: Number(params.vendedor) || undefined, channel: Number(params.canal) || undefined, paymentMethod: Number(params.pago) || undefined, number: params.numero });
  const filtered = Object.values(params).some(Boolean);
  return <ContentContainer>
    <PageHeader eyebrow="Consulta comercial" title="Historial de ventas" description="Filtra y consulta las ventas registradas segÃºn tu alcance de acceso." actions={<Link href="/ventas" className="inline-flex h-11 items-center rounded-xl border bg-lf-surface px-4 text-sm font-semibold">Volver a ventas</Link>} />
    <form className="mb-6 grid gap-3 rounded-2xl border bg-lf-surface p-4 shadow-[var(--lf-shadow-sm)] sm:grid-cols-2 lg:grid-cols-6">
      <label><span className="mb-1.5 block text-xs font-semibold">Desde</span><input type="date" name="desde" defaultValue={params.desde} className="h-11 w-full rounded-xl border bg-white px-3" /></label>
      <label><span className="mb-1.5 block text-xs font-semibold">Hasta</span><input type="date" name="hasta" defaultValue={params.hasta} className="h-11 w-full rounded-xl border bg-white px-3" /></label>
      <label><span className="mb-1.5 block text-xs font-semibold">Vendedor</span><select name="vendedor" defaultValue={params.vendedor ?? ""} className="h-11 w-full rounded-xl border bg-white px-3"><option value="">Todos</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
      <label><span className="mb-1.5 block text-xs font-semibold">Canal</span><select name="canal" defaultValue={params.canal ?? ""} className="h-11 w-full rounded-xl border bg-white px-3"><option value="">Todos</option>{channels.map((channel) => <option key={channel.id_canal} value={channel.id_canal}>{channel.nombre}</option>)}</select></label>
      <label><span className="mb-1.5 block text-xs font-semibold">Forma de pago</span><select name="pago" defaultValue={params.pago ?? ""} className="h-11 w-full rounded-xl border bg-white px-3"><option value="">Todas</option>{paymentMethods.map((method) => <option key={method.id_forma_pago} value={method.id_forma_pago}>{method.nombre}</option>)}</select></label>
      <label><span className="mb-1.5 block text-xs font-semibold">NÃºmero de venta</span><input name="numero" defaultValue={params.numero} maxLength={60} placeholder="V-2026..." className="h-11 w-full rounded-xl border bg-white px-3" /></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end"><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white"><Search size={17} /> Buscar</button>{filtered ? <Link href="/ventas/historial" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold"><FilterX size={17} /> Limpiar</Link> : null}</div>
    </form>
    {sales.length ? <><TableContainer><Table><thead><tr><TableHead>N.Âº</TableHead><TableHead>Fecha</TableHead><TableHead>Vendedor</TableHead><TableHead>Canal</TableHead><TableHead>Total</TableHead><TableHead>Forma de pago</TableHead><TableHead>Acciones</TableHead></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id_venta} className="hover:bg-lf-surface-muted/60"><TableCell><p className="font-mono text-sm font-semibold">{sale.numero_venta}</p><Badge variant={sale.estado === "REGISTRADA" ? "success" : sale.estado === "ANULADA" ? "danger" : "neutral"}>{sale.estado}</Badge></TableCell><TableCell className="whitespace-nowrap text-sm">{dateFormatter.format(new Date(sale.fecha))}</TableCell><TableCell>{sale.vendedor}</TableCell><TableCell><p>{sale.canal}</p><p className="text-xs text-lf-muted">{sale.local}</p></TableCell><TableCell className="font-bold">{currency.format(sale.total)}</TableCell><TableCell>{sale.paymentMethods}</TableCell><TableCell><Link href={`/ventas/${sale.id_venta}`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold hover:border-lf-terracotta"><Eye size={15} /> Ver detalle</Link></TableCell></tr>)}</tbody></Table></TableContainer><p className="mt-3 text-sm text-lf-muted">{sales.length} venta(s). Se muestran hasta 200 resultados.</p></> : <Card><CardContent className="grid min-h-56 place-items-center text-center"><div><Search size={32} className="mx-auto text-lf-muted" /><p className="mt-3 font-semibold">No se encontraron ventas</p><p className="mt-1 text-sm text-lf-muted">Cambia o limpia los filtros para ampliar la bÃºsqueda.</p></div></CardContent></Card>}
  </ContentContainer>;
}

