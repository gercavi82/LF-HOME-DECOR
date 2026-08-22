import { AlertTriangle, ArrowRight, Ban, CalendarDays, ChartColumnIncreasing, CircleDollarSign, PackageX, ReceiptText } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
import { getDashboardData, type DashboardDay } from "@/src/services/dashboard/dashboard";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function MetricCard({ label, value, detail, icon: Icon, tone = "navy" }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof CircleDollarSign;
  tone?: "navy" | "terracotta" | "warning" | "danger";
}) {
  const tones = {
    navy: "bg-lf-navy/10 text-lf-navy",
    terracotta: "bg-lf-terracotta/10 text-lf-terracotta",
    warning: "bg-[var(--lf-warning-soft)] text-lf-warning",
    danger: "bg-[var(--lf-danger-soft)] text-lf-danger",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 sm:pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-sm font-medium text-lf-muted">{label}</p><p className="mt-2 truncate text-2xl font-bold tracking-tight text-lf-navy">{value}</p><p className="mt-1 text-xs text-lf-muted">{detail}</p></div>
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon size={21} aria-hidden="true" /></span>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesChart({ days }: { days: DashboardDay[] }) {
  const maximum = Math.max(...days.map((day) => day.total), 1);
  return (
    <div className="mt-4">
      <div className="grid h-56 grid-cols-7 items-end gap-2 sm:gap-4" role="img" aria-label="Ventas de los últimos siete días">
        {days.map((day) => {
          const height = day.total ? Math.max((day.total / maximum) * 100, 7) : 2;
          return (
            <div key={day.key} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
              <span className="hidden text-xs font-semibold text-lf-navy sm:block">{day.total ? currency.format(day.total) : "—"}</span>
              <div className="flex h-40 items-end justify-center rounded-xl bg-lf-surface-muted px-1"><div className="w-full max-w-12 rounded-t-lg bg-lf-terracotta transition-[height]" style={{ height: `${height}%` }} title={`${day.label}: ${currency.format(day.total)} en ${day.count} venta(s)`} /></div>
              <span className="truncate text-xs capitalize text-lf-muted">{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return (
    <ContentContainer>
      <PageHeader eyebrow="Resumen operativo" title={`Hola, ${data.context.nombres}`} description="Indicadores de ventas e inventario actualizados con la información disponible." actions={<Link href="/ventas" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover">Ir a ventas <ArrowRight size={17} aria-hidden="true" /></Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Ventas de hoy" value={currency.format(data.salesToday)} detail={`${data.salesCountToday} venta(s) registrada(s)`} icon={CircleDollarSign} tone="terracotta" />
        <MetricCard label="Ventas del mes" value={currency.format(data.salesMonth)} detail={`${data.salesCountMonth} venta(s) acumulada(s)`} icon={CalendarDays} />
        <MetricCard label="Cantidad de ventas" value={data.salesCountMonth} detail="Operaciones del mes actual" icon={ReceiptText} />
        <MetricCard label="Productos con stock bajo" value={data.lowStockCount} detail="Requieren reposición" icon={AlertTriangle} tone="warning" />
        <MetricCard label="Productos agotados" value={data.outOfStockCount} detail="Sin unidades disponibles" icon={PackageX} tone="danger" />
        <MetricCard label="Estado de operación" value={data.outOfStockCount ? "Revisar" : "Normal"} detail={data.outOfStockCount ? "Existen alertas críticas" : "Sin productos agotados"} icon={data.outOfStockCount ? Ban : ChartColumnIncreasing} tone={data.outOfStockCount ? "danger" : "navy"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Ventas de los últimos 7 días</CardTitle><p className="mt-1 text-sm text-lf-muted">Valores diarios en dólares</p></div><ChartColumnIncreasing className="text-lf-terracotta" aria-hidden="true" /></div></CardHeader>
          <CardContent><SalesChart days={data.lastSevenDays} /></CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Alertas recientes</CardTitle><Badge variant={data.alerts.length ? "warning" : "success"}>{data.alerts.length ? `${data.alerts.length} visibles` : "Sin alertas"}</Badge></div></CardHeader>
          <CardContent>
            {data.alerts.length ? <div className="divide-y">{data.alerts.map((alert) => (
              <div key={alert.id_stock} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${alert.stock_actual <= 0 ? "bg-[var(--lf-danger-soft)] text-lf-danger" : "bg-[var(--lf-warning-soft)] text-lf-warning"}`}><AlertTriangle size={18} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{alert.producto}</p><p className="truncate text-xs text-lf-muted">{alert.bodega}{alert.codigo_gs1 ? ` · ${alert.codigo_gs1}` : ""}</p></div>
                <div className="text-right"><p className={`text-sm font-bold ${alert.stock_actual <= 0 ? "text-lf-danger" : "text-lf-warning"}`}>{alert.stock_actual}</p><p className="text-[0.7rem] text-lf-muted">mín. {alert.stock_minimo}</p></div>
              </div>
            ))}</div> : <div className="grid min-h-52 place-items-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--lf-success-soft)] text-lf-success"><ChartColumnIncreasing size={22} /></span><p className="mt-3 font-semibold">Inventario saludable</p><p className="mt-1 text-sm text-lf-muted">No existen alertas de stock bajo.</p></div></div>}
            <Link href="/inventario" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lf-terracotta hover:text-lf-terracotta-hover">Ver inventario <ArrowRight size={15} /></Link>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  );
}
