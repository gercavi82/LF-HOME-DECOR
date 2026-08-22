import { AlertTriangle, Boxes, CheckCircle2, History, PackageX, Plus, Search } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { getInventory, type InventoryStatus } from "@/src/services/inventory/inventory";
import { getAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";

const statusPresentation: Record<InventoryStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  DISPONIBLE: { label: "Disponible", variant: "success" },
  "BAJO STOCK": { label: "Bajo stock", variant: "warning" },
  AGOTADO: { label: "Agotado", variant: "danger" },
};

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Boxes; tone: string }) {
  return <Card><CardContent className="pt-5 sm:pt-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-lf-muted">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon size={21} /></span></div></CardContent></Card>;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q = "", estado = "" } = await searchParams;
  const [inventory, context] = await Promise.all([getInventory(q, estado), getAuthContext()]);
  const canAdjust = context?.perfil === ROLE_NAMES.ADMINISTRADOR || context?.permisos.some((permission) => permission.codigo === "INVENTARIO_AJUSTAR");
  return <ContentContainer>
    <PageHeader eyebrow="Control de existencias" title="Inventario" description="Consulta existencias y alertas por producto, variante y bodega." actions={<div className="flex gap-2"><Link href="/inventario/movimientos" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold hover:bg-lf-surface-muted"><History size={17} /> Movimientos</Link>{canAdjust ? <Link href="/inventario/ajustes/nuevo" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Plus size={17} /> Nuevo ajuste</Link> : null}</div>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Registros de stock" value={inventory.summary.total} icon={Boxes} tone="bg-lf-navy/10 text-lf-navy" />
      <SummaryCard label="Disponibles" value={inventory.summary.available} icon={CheckCircle2} tone="bg-[var(--lf-success-soft)] text-lf-success" />
      <SummaryCard label="Bajo stock" value={inventory.summary.low} icon={AlertTriangle} tone="bg-[var(--lf-warning-soft)] text-lf-warning" />
      <SummaryCard label="Agotados" value={inventory.summary.out} icon={PackageX} tone="bg-[var(--lf-danger-soft)] text-lf-danger" />
    </div>
    <form className="mb-5 grid gap-3 rounded-2xl border bg-lf-surface p-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto_auto]">
      <label className="relative"><span className="sr-only">Buscar inventario</span><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" /><input name="q" defaultValue={q} placeholder="Producto, GS1 o bodega..." className="h-11 w-full rounded-xl border bg-white pl-10 pr-4 outline-none focus:border-lf-terracotta" /></label>
      <select name="estado" defaultValue={inventory.status ?? ""} className="h-11 rounded-xl border bg-white px-3 outline-none focus:border-lf-terracotta"><option value="">Todos los estados</option><option value="DISPONIBLE">Disponible</option><option value="BAJO STOCK">Bajo stock</option><option value="AGOTADO">Agotado</option></select>
      <button className="h-11 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white">Filtrar</button>
      {(q || estado) ? <Link href="/inventario" className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold hover:bg-lf-surface-muted">Limpiar</Link> : <span />}
    </form>
    {inventory.items.length ? <><TableContainer><Table><thead><tr><TableHead>Producto / GS1</TableHead><TableHead>Bodega</TableHead><TableHead>Stock actual</TableHead><TableHead>Stock mínimo</TableHead><TableHead>Estado</TableHead></tr></thead><tbody>{inventory.items.map((item) => {
      const presentation = statusPresentation[item.estado_stock];
      return <tr key={item.id_stock} className="hover:bg-lf-surface-muted/60"><TableCell><Link href={`/productos/${item.id_producto}`} className="font-semibold hover:text-lf-terracotta">{item.producto}</Link><p className="mt-0.5 font-mono text-xs text-lf-muted">{item.codigo_gs1}</p><p className="mt-0.5 text-xs text-lf-muted">{[item.categoria, item.marca, item.tamano, item.color].filter(Boolean).join(" · ")}</p></TableCell><TableCell>{item.bodega}</TableCell><TableCell><span className={`text-lg font-bold ${item.estado_stock === "AGOTADO" ? "text-lf-danger" : item.estado_stock === "BAJO STOCK" ? "text-lf-warning" : "text-lf-navy"}`}>{item.stock_actual}</span></TableCell><TableCell>{item.stock_minimo}</TableCell><TableCell><Badge variant={presentation.variant}>{presentation.label}</Badge></TableCell></tr>;
    })}</tbody></Table></TableContainer><p className="mt-3 text-sm text-lf-muted">{inventory.count} registro(s). Se muestran hasta 200 resultados.</p></> : <Card><CardContent className="grid min-h-60 place-items-center text-center"><div><Boxes className="mx-auto text-lf-muted" size={32} /><p className="mt-3 font-semibold">No hay existencias para mostrar</p><p className="mt-1 text-sm text-lf-muted">Prueba con otro filtro o registra movimientos de inventario.</p></div></CardContent></Card>}
  </ContentContainer>;
}
