import {
  AlertTriangle,
  BellRing,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  PackageX,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent } from "@/src/components/ui";
import { getAlerts, type AlertItem } from "@/src/services/alerts/alerts";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo = "" } = await searchParams;
  const data = await getAlerts(tipo);

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Centro de alertas"
        title="Alertas operativas y financieras"
        description="Supervisión en tiempo real de inventario, pagos pendientes a proveedores y gastos fijos."
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

      {/* Tarjetas de Filtro Rápido */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Link
          href="/alertas"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            !data.type
              ? "border-lf-navy bg-lf-navy text-white"
              : "bg-lf-surface hover:border-lf-navy/40"
          }`}
        >
          <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Todas</p>
          <p className="mt-1 text-2xl font-bold">{data.summary.total}</p>
          <p className="mt-0.5 text-xs opacity-70">Alertas activas</p>
        </Link>

        <Link
          href="/alertas?tipo=vencidos"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            data.type === "vencidos"
              ? "border-red-600 bg-red-600 text-white"
              : "border-l-4 border-l-red-500 bg-lf-surface hover:border-red-400"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${data.type === "vencidos" ? "text-white" : "text-red-700"}`}>
            Pagos Vencidos
          </p>
          <p className={`mt-1 text-2xl font-bold ${data.type === "vencidos" ? "text-white" : "text-red-700"}`}>
            {data.summary.overdue}
          </p>
          <p className={`mt-0.5 text-xs ${data.type === "vencidos" ? "opacity-80" : "text-red-600"}`}>
            +30 días de antigüedad
          </p>
        </Link>

        <Link
          href="/alertas?tipo=proximos"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            data.type === "proximos"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-l-4 border-l-amber-500 bg-lf-surface hover:border-amber-400"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${data.type === "proximos" ? "text-white" : "text-amber-800"}`}>
            Pagos Próximos
          </p>
          <p className={`mt-1 text-2xl font-bold ${data.type === "proximos" ? "text-white" : "text-amber-800"}`}>
            {data.summary.upcoming}
          </p>
          <p className={`mt-0.5 text-xs ${data.type === "proximos" ? "opacity-80" : "text-amber-700"}`}>
            15 a 29 días pendientes
          </p>
        </Link>

        <Link
          href="/alertas?tipo=minimo"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            data.type === "minimo"
              ? "border-amber-600 bg-amber-600 text-white"
              : "border-l-4 border-l-amber-500 bg-lf-surface hover:border-amber-400"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${data.type === "minimo" ? "text-white" : "text-slate-600"}`}>
            Stock Mínimo
          </p>
          <p className={`mt-1 text-2xl font-bold ${data.type === "minimo" ? "text-white" : "text-amber-600"}`}>
            {data.summary.low}
          </p>
          <p className={`mt-0.5 text-xs ${data.type === "minimo" ? "opacity-80" : "text-slate-500"}`}>
            Por agotarse
          </p>
        </Link>

        <Link
          href="/alertas?tipo=agotado"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            data.type === "agotado"
              ? "border-red-600 bg-red-600 text-white"
              : "border-l-4 border-l-red-500 bg-lf-surface hover:border-red-400"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${data.type === "agotado" ? "text-white" : "text-red-700"}`}>
            Agotados
          </p>
          <p className={`mt-1 text-2xl font-bold ${data.type === "agotado" ? "text-white" : "text-red-700"}`}>
            {data.summary.out}
          </p>
          <p className={`mt-0.5 text-xs ${data.type === "agotado" ? "opacity-80" : "text-red-600"}`}>
            0 unidades
          </p>
        </Link>

        <Link
          href="/alertas?tipo=gastos"
          className={`rounded-2xl border p-4 transition shadow-2xs ${
            data.type === "gastos"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-l-4 border-l-blue-500 bg-lf-surface hover:border-blue-400"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${data.type === "gastos" ? "text-white" : "text-blue-800"}`}>
            Gastos Fijos
          </p>
          <p className={`mt-1 text-2xl font-bold ${data.type === "gastos" ? "text-white" : "text-blue-800"}`}>
            {data.summary.expenses}
          </p>
          <p className={`mt-0.5 text-xs ${data.type === "gastos" ? "opacity-80" : "text-blue-700"}`}>
            Control mensual
          </p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Listado de Alertas Activas */}
        <section>
          {data.alerts.length ? (
            <div className="space-y-3">
              {data.alerts.map((alert) => {
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
                  <p className="text-lg font-bold text-lf-navy">Sin alertas activas</p>
                  <p className="mt-1 text-sm text-lf-muted max-w-md">
                    Todos los niveles de inventario, pagos a proveedores y gastos se encuentran al día dentro de los parámetros esperados.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Panel Lateral: Criterios y Políticas de Alertas */}
        <aside className="h-fit rounded-2xl border bg-lf-surface p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-lf-navy flex items-center gap-2">
            <Clock3 size={17} className="text-lf-terracotta" /> Políticas de Alertas
          </h2>
          <p className="text-xs text-lf-muted">
            Reglas configuradas para el monitoreo preventivo de tu negocio:
          </p>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
              <p className="font-bold text-red-800 flex items-center gap-1">
                <CreditCard size={13} /> Pagos Vencidos a Proveedores
              </p>
              <p className="mt-1 text-red-700">
                Se activa cuando una factura de compra tiene saldo pendiente y lleva más de <strong>30 días</strong> desde su emisión.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <p className="font-bold text-amber-800 flex items-center gap-1">
                <Clock3 size={13} /> Pagos Próximos a Proveedores
              </p>
              <p className="mt-1 text-amber-700">
                Avisa cuando una compra tiene entre <strong>15 y 29 días</strong> con saldo pendiente por liquidar.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <p className="font-bold text-amber-800 flex items-center gap-1">
                <AlertTriangle size={13} /> Stock Mínimo
              </p>
              <p className="mt-1 text-amber-700">
                Alerta cuando las existencias en bodega son menores o iguales al <strong>stock mínimo</strong> configurado en el producto (por defecto 5 uds).
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <p className="font-bold text-blue-800 flex items-center gap-1">
                <Receipt size={13} /> Gastos Fijos Mensuales
              </p>
              <p className="mt-1 text-blue-700">
                Recuerda el registro de arriendos y servicios básicos si no se han asentado a partir del día 5 del mes.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </ContentContainer>
  );
}
