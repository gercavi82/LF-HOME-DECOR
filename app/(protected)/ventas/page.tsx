import { Eye, History, Plus, ReceiptText, Search } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listSales } from "@/src/services/sales/sales";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" });

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; created?: string }> }) {
  const { q = "", created } = await searchParams;
  const { sales, count, context } = await listSales(q);
  const canCreate = context.perfil === "Administrador" || context.permisos.some((permission) => permission.codigo === "VENTA_CREAR");
  return <ContentContainer>
    <PageHeader eyebrow="OperaciÃ³n comercial" title="Ventas" description="Consulta las operaciones registradas y comienza una venta rÃ¡pida." actions={<><Link href="/ventas/historial" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><History size={18} /> Historial</Link>{canCreate ? <Link href="/ventas/nueva" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Plus size={18} /> Nueva venta</Link> : null}</>} />
    {created ? <Alert variant="success" className="mb-5">Venta {created} registrada correctamente.</Alert> : null}
    <form className="mb-5 flex gap-3 rounded-2xl border bg-lf-surface p-3"><label className="relative flex-1"><span className="sr-only">Buscar venta</span><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" /><input name="q" defaultValue={q} placeholder="Buscar por nÃºmero de venta..." className="h-11 w-full rounded-xl border bg-white pl-10 pr-4 outline-none focus:border-lf-terracotta" /></label><button className="rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white">Buscar</button>{q ? <Link href="/ventas" className="inline-flex items-center rounded-xl border px-4 text-sm font-semibold">Limpiar</Link> : null}</form>
    {sales.length ? <><TableContainer><Table><thead><tr><TableHead>Venta</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Canal / Local</TableHead><TableHead>Vendedor</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id_venta} className="hover:bg-lf-surface-muted/60"><TableCell className="font-mono text-sm font-semibold">{sale.numero_venta}</TableCell><TableCell className="whitespace-nowrap text-sm">{dateFormatter.format(new Date(sale.fecha))}</TableCell><TableCell>{sale.cliente}</TableCell><TableCell><p>{sale.canal}</p><p className="text-xs text-lf-muted">{sale.local}</p></TableCell><TableCell>{sale.vendedor}</TableCell><TableCell className="font-bold">{currency.format(sale.total)}</TableCell><TableCell><Badge variant={sale.estado === "REGISTRADA" ? "success" : sale.estado === "ANULADA" ? "danger" : "neutral"}>{sale.estado}</Badge></TableCell><TableCell><Link href={`/ventas/${sale.id_venta}`} title="Ver detalle" className="inline-grid size-9 place-items-center rounded-lg border bg-white text-lf-navy hover:border-lf-terracotta"><Eye size={16} /><span className="sr-only">Ver detalle de {sale.numero_venta}</span></Link></TableCell></tr>)}</tbody></Table></TableContainer><p className="mt-3 text-sm text-lf-muted">{count} venta(s). Se muestran hasta 50 resultados.</p></> : <Card><CardContent className="grid min-h-64 place-items-center text-center"><div><ReceiptText size={34} className="mx-auto text-lf-muted" /><p className="mt-3 font-semibold">No hay ventas registradas</p><p className="mt-1 text-sm text-lf-muted">Inicia una nueva venta para comenzar.</p>{canCreate ? <Link href="/ventas/nueva" className="mt-4 inline-flex items-center gap-2 font-semibold text-lf-terracotta"><Plus size={17} /> Nueva venta</Link> : null}</div></CardContent></Card>}
  </ContentContainer>;
}

