import {
  Boxes,
  ExternalLink,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { getAlerts } from "@/src/services/alerts/alerts";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await searchParams;
  const data = await getAlerts();
  const balance = data.alerts.find((alert) => alert.id === "pago-diferencia-global-500");
  const pending = balance?.totalSalesCost !== undefined && balance.totalDeposits !== undefined
    ? Math.max(0, Math.round(balance.totalSalesCost * 100) - Math.round(balance.totalDeposits * 100)) / 100
    : null;
  const exceedsLimit = pending !== null && pending >= 500.01;

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Centro de alertas"
        title="Alerta de saldo pendiente"
        description="Costo total de ventas por tipo de producto menos total de depósitos a proveedores."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inventario"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold text-lf-navy hover:bg-lf-surface-muted transition shadow-2xs"
            >
              <Boxes size={14} /> Inventario
            </Link>
            <Link
              href="/compras"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-lf-navy px-3 text-xs font-semibold text-white hover:bg-lf-navy-hover transition shadow-sm"
            >
              <Truck size={14} /> Compras y Abonos
            </Link>
          </div>
        }
      />

      <section aria-label="Resumen de saldo pendiente">
        <Link
          href="/reportes"
          aria-label="Saldo pendiente. Ver reporte de ventas"
          className="block w-full rounded-2xl border border-l-4 border-lf-border bg-lf-surface px-5 py-4 text-emerald-700 shadow-[var(--lf-shadow-sm)] transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 sm:max-w-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider">Saldo pendiente</h2>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${exceedsLimit ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
              {pending === null ? "Sin datos" : exceedsLimit ? `≥ ${currency.format(500.01)}` : "Bajo el límite"}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
            {pending === null ? "No disponible" : currency.format(pending)}
          </p>
          <p className="mt-1 text-xs leading-5">
            {pending === null
              ? "No se pudo consultar el saldo. Vuelve a cargar la página."
              : `Costo: ${currency.format(balance!.totalSalesCost!)} · Depósitos: ${currency.format(balance!.totalDeposits!)}`}
          </p>
          {pending !== null ? (
            <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${exceedsLimit ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
              {exceedsLimit
                ? "¡Es momento de ponernos al día! Un abono hoy nos ayuda a mantener el saldo bajo control."
                : pending === 0
                ? "¡Todo al día! Sigamos sumando ventas y cuidando cada detalle."
                : "¡Vamos bien! El saldo está bajo control; sigamos al día con nuestros abonos."}
            </p>
          ) : null}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
            Ver reporte de ventas <ExternalLink size={11} aria-hidden="true" />
          </span>
        </Link>
      </section>
    </ContentContainer>
  );
}
