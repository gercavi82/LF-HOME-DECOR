import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  PackageX,
  Receipt,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent } from "@/src/components/ui";
import { getAlerts } from "@/src/services/alerts/alerts";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await searchParams;
  const data = await getAlerts();

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

      <div className="grid gap-6">
        {/* Listado de Alertas Activas */}
        <section>
          {data.alerts.length ? (
            <div className="space-y-3">
              {data.alerts.map((alert) => {
                if (alert.id === "pago-diferencia-global-500") {
                  const pending = Math.max(
                    0,
                    Math.round((alert.totalSalesCost ?? 0) * 100) - Math.round((alert.totalDeposits ?? 0) * 100),
                  ) / 100;

                  return (
                    <Link
                      key={alert.id}
                      href={alert.href}
                      aria-label={`Saldo pendiente: ${currency.format(pending)}. Ver reporte de ventas`}
                      className="block w-full rounded-2xl border border-l-4 border-lf-border bg-lf-surface px-5 py-4 text-emerald-700 shadow-[var(--lf-shadow-sm)] transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 sm:max-w-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider">
                          Saldo pendiente
                        </h2>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          ≥ {currency.format(500.01)}
                        </span>
                      </div>
                      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                        {currency.format(pending)}
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        Costo: {currency.format(alert.totalSalesCost ?? 0)} · Depósitos: {currency.format(alert.totalDeposits ?? 0)}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
                        {alert.actionLabel} <ExternalLink size={11} aria-hidden="true" />
                      </span>
                    </Link>
                  );
                }

                const isDanger = alert.severity === "danger";
                const isPayment = alert.category === "PAGOS";
                const isExpense = alert.category === "GASTOS";

                return (
                  <article
                    key={alert.id}
                    className="flex flex-col gap-4 rounded-2xl border bg-lf-surface p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center"
                  >
                    <span
                      className={`grid size-12 shrink-0 place-items-center rounded-xl ${
                        isDanger
                          ? "bg-red-100 text-red-700"
                          : isExpense
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isPayment ? (
                        <CreditCard size={22} />
                      ) : isExpense ? (
                        <Receipt size={22} />
                      ) : isDanger ? (
                        <PackageX size={22} />
                      ) : (
                        <AlertTriangle size={22} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={alert.href}
                          className="font-semibold text-lf-navy hover:text-lf-terracotta transition"
                        >
                          {alert.title}
                        </Link>
                        <Badge variant={isDanger ? "danger" : "warning"}>
                          {alert.badgeLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 font-medium">
                        {alert.subtitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        {alert.detail}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center">
                      <div className="text-left sm:text-right">
                        <p
                          className={`text-xl font-bold font-mono ${
                            isDanger
                              ? "text-red-700"
                              : isExpense
                              ? "text-blue-800"
                              : "text-amber-700"
                          }`}
                        >
                          {alert.valuePrimary}
                        </p>
                        {alert.valueSecondary ? (
                          <p className="text-xs text-slate-400 font-medium">
                            {alert.valueSecondary}
                          </p>
                        ) : null}
                      </div>

                      <Link
                        href={alert.href}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-lf-navy hover:bg-lf-surface-muted transition shadow-2xs"
                      >
                        {alert.actionLabel} <ExternalLink size={11} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="grid min-h-64 place-items-center text-center p-8">
                <div>
                  <div className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 mx-auto mb-3">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-lg font-bold text-lf-navy">¡Todo bajo control!</p>
                  <p className="mt-1 text-sm text-lf-muted max-w-md">
                    Tu saldo pendiente está por debajo de $500,01. Puedes seguir trabajando con tranquilidad; aquí te avisaremos cuando alcance o supere ese valor.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>


      </div>
    </ContentContainer>
  );
}
