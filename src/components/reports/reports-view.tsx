"use client";

import { useState } from "react";
import {
  Users,
  Store,
  Calendar,
  Layers,
  Receipt,
  History,
  TrendingUp,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { FinancialReportData } from "@/src/services/reports/reports";
import { CommissionPaymentModal } from "@/src/components/commissions/payment-modal";
import { InteractiveReportsCharts } from "./interactive-charts";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

const MONTHS_LIST = [
  { value: "01", label: "01 - Enero" },
  { value: "02", label: "02 - Febrero" },
  { value: "03", label: "03 - Marzo" },
  { value: "04", label: "04 - Abril" },
  { value: "05", label: "05 - Mayo" },
  { value: "06", label: "06 - Junio" },
  { value: "07", label: "07 - Julio" },
  { value: "08", label: "08 - Agosto" },
  { value: "09", label: "09 - Septiembre" },
  { value: "10", label: "10 - Octubre" },
  { value: "11", label: "11 - Noviembre" },
  { value: "12", label: "12 - Diciembre" },
];

type CommissionPaymentItem = {
  id_pago_comision: number;
  id_usuario: number;
  asesor: string;
  monto: number;
  fecha: string;
  forma_pago: string;
  referencia: string | null;
  observaciones: string | null;
  registrador: string;
};

type TabType = "ASESORES" | "LOCAL" | "MENSUAL" | "PRODUCTOS";

export function ReportsView({
  data,
  commissionPayments,
  filters,
}: {
  data: FinancialReportData;
  commissionPayments: CommissionPaymentItem[];
  filters: { anio: string; mes: string; tipo: string };
}) {
  const [activeTab, setActiveTab] = useState<TabType>("ASESORES");

  const hasActiveFilters = Boolean(filters.anio || filters.mes || filters.tipo);

  // Advisors list for modal
  const advisorOptions = data.advisors.map((a) => ({
    id_usuario: a.id_usuario,
    asesor: a.asesor,
    saldo_pendiente: Math.max(0, a.comision_asesor - a.comision_pagada),
  }));

  // Totales
  const sumMonthlyUnidades = data.monthlyBreakdown.reduce((sum, m) => sum + m.unidades, 0);
  const sumMonthlyVentas = data.monthlyBreakdown.reduce((sum, m) => sum + m.total_ventas, 0);
  const sumMonthlyCostos = data.monthlyBreakdown.reduce((sum, m) => sum + m.total_costo, 0);
  const sumMonthlyUtilidad = data.monthlyBreakdown.reduce((sum, m) => sum + m.utilidad, 0);
  const sumMonthlyComisionAsesores = data.monthlyBreakdown.reduce((sum, m) => sum + m.comision_asesores, 0);
  const sumMonthlyComisionLocal = data.monthlyBreakdown.reduce((sum, m) => sum + m.comision_local, 0);
  const sumMonthlyGastos = data.monthlyBreakdown.reduce((sum, m) => sum + (m.gastos || 0), 0);
  const sumMonthlySaldoLocal = data.monthlyBreakdown.reduce((sum, m) => sum + (m.saldo_comision_local ?? (m.comision_local - (m.gastos || 0))), 0);

  const sumTypeUnidades = data.typeBreakdown.reduce((sum, t) => sum + t.unidades, 0);
  const sumTypeVentas = data.typeBreakdown.reduce((sum, t) => sum + t.total_ventas, 0);
  const sumTypeCostos = data.typeBreakdown.reduce((sum, t) => sum + t.total_costo, 0);
  const sumTypeUtilidad = data.typeBreakdown.reduce((sum, t) => sum + t.utilidad, 0);

  const sumAdvisorVentas = data.advisors.reduce((sum, a) => sum + a.total_ventas, 0);
  const sumAdvisorUtilidad = data.advisors.reduce((sum, a) => sum + a.total_utilidad, 0);
  const sumAdvisorComision = data.advisors.reduce((sum, a) => sum + a.comision_asesor, 0);
  const sumAdvisorPagado = data.advisors.reduce((sum, a) => sum + a.comision_pagada, 0);
  const sumAdvisorPendiente = data.advisors.reduce((sum, a) => sum + Math.max(0, a.comision_asesor - a.comision_pagada), 0);

  // Gráficos
  const chartMonthlyData = data.monthlyBreakdown.map((m) => ({
    year_month: m.year_month,
    label: m.label,
    total_ventas: m.total_ventas,
    total_compras: m.total_compras || 0,
    utilidad: m.utilidad,
    comision_asesores: m.comision_asesores,
  }));

  const chartAdvisorData = data.advisors.map((a) => ({
    id_usuario: a.id_usuario,
    asesor: a.asesor,
    total_ventas: a.total_ventas,
    total_utilidad: a.total_utilidad,
    comision_asesor: a.comision_asesor,
    comision_pagada: a.comision_pagada,
    saldo_pendiente: Math.max(0, a.comision_asesor - a.comision_pagada),
  }));

  return (
    <div className="space-y-6">
      {/* Barra de Filtros por Año, Mes y Tipo */}
      <form method="GET" className="rounded-2xl border bg-lf-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[140px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Año
            </span>
            <select
              name="anio"
              defaultValue={filters.anio}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los años</option>
              {data.availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="block flex-1 min-w-[160px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Mes
            </span>
            <select
              name="mes"
              defaultValue={filters.mes}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los meses</option>
              {MONTHS_LIST.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Tipo de producto
            </span>
            <select
              name="tipo"
              defaultValue={filters.tipo}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los tipos</option>
              {data.availableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lf-navy px-4 text-sm font-semibold text-white hover:bg-lf-navy-hover"
            >
              <Filter size={15} /> Filtrar
            </button>
            {hasActiveFilters ? (
              <Link
                href="/reportes"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-lf-surface-muted px-3 text-sm font-medium text-lf-muted hover:text-lf-navy"
                title="Limpiar filtros"
              >
                <RotateCcw size={15} /> Limpiar
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {/* Tarjetas de Resumen Financiero Global */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Ventas Totales</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(data.kpis.totalVentas)}</p>
            <p className="mt-1 text-xs text-lf-muted">
              {data.kpis.totalUnidades} unidades · Utilidad: {currency.format(data.kpis.utilidadBruta)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Comisión Asesores (60%)</p>
              <Badge variant="success">60%</Badge>
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(data.kpis.comisionesAsesores)}</p>
            <p className="mt-1 text-xs text-emerald-700">
              Pagado: {currency.format(data.kpis.comisionesPagadas)} · Pendiente: {currency.format(data.kpis.comisionesPendientes)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Comisión Local (40%)</p>
              <Badge variant="neutral">40%</Badge>
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(data.kpis.comisionesLocal)}</p>
            <p className="mt-1 text-xs text-amber-800">
              Gastos: {currency.format(data.kpis.gastosOperativos)}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${data.kpis.saldoComisionLocal >= 0 ? "border-l-blue-600 bg-blue-50/20" : "border-l-red-600 bg-red-50/20"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">Saldo Disponible Local</p>
              <Badge variant={data.kpis.saldoComisionLocal >= 0 ? "success" : "danger"}>40% − Gastos</Badge>
            </div>
            <p className={`mt-1 text-2xl font-bold ${data.kpis.saldoComisionLocal >= 0 ? "text-blue-800" : "text-red-700"}`}>
              {currency.format(data.kpis.saldoComisionLocal)}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              {data.kpis.saldoComisionLocal >= 0 ? "Saldo a favor para el local" : "Déficit operativo temporal"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN SEGREGADAS */}
      <div className="border-b border-[#E7DED1]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("ASESORES")}
            className={`flex items-center gap-2 rounded-t-2xl border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "ASESORES"
                ? "border-emerald-600 bg-white text-emerald-800 shadow-sm"
                : "border-transparent text-lf-muted hover:bg-white/50 hover:text-lf-navy"
            }`}
          >
            <Users size={18} className={activeTab === "ASESORES" ? "text-emerald-600" : "text-lf-muted"} />
            <span>Liquidación de Asesores (60%)</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {currency.format(data.kpis.comisionesAsesores)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("LOCAL")}
            className={`flex items-center gap-2 rounded-t-2xl border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "LOCAL"
                ? "border-amber-500 bg-white text-amber-900 shadow-sm"
                : "border-transparent text-lf-muted hover:bg-white/50 hover:text-lf-navy"
            }`}
          >
            <Store size={18} className={activeTab === "LOCAL" ? "text-amber-500" : "text-lf-muted"} />
            <span>Liquidación Local (40%) y Gastos</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${data.kpis.saldoComisionLocal >= 0 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
              {currency.format(data.kpis.saldoComisionLocal)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MENSUAL")}
            className={`flex items-center gap-2 rounded-t-2xl border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "MENSUAL"
                ? "border-blue-600 bg-white text-blue-900 shadow-sm"
                : "border-transparent text-lf-muted hover:bg-white/50 hover:text-lf-navy"
            }`}
          >
            <Calendar size={18} className={activeTab === "MENSUAL" ? "text-blue-600" : "text-lf-muted"} />
            <span>Evolución Mensual y Anual</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
              {data.monthlyBreakdown.length} meses
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PRODUCTOS")}
            className={`flex items-center gap-2 rounded-t-2xl border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "PRODUCTOS"
                ? "border-purple-600 bg-white text-purple-900 shadow-sm"
                : "border-transparent text-lf-muted hover:bg-white/50 hover:text-lf-navy"
            }`}
          >
            <Layers size={18} className={activeTab === "PRODUCTOS" ? "text-purple-600" : "text-lf-muted"} />
            <span>Ventas por Tipo de Producto</span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
              {data.typeBreakdown.length} tipos
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: LIQUIDACIÓN DE ASESORES (60%) */}
      {/* ========================================================= */}
      {activeTab === "ASESORES" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-lf-navy">
                <Users size={22} className="text-emerald-600" /> Liquidación de Comisiones por Asesor (60%)
              </h2>
              <p className="text-sm text-lf-muted">
                Cálculo transaccional de ventas, utilidad neta por producto y saldo pendiente de liquidar.
              </p>
            </div>
            <CommissionPaymentModal advisors={advisorOptions} />
          </div>

          {/* Tarjetas de estado de comisiones de asesores */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Comisiones Generadas (60%)</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(sumAdvisorComision)}</p>
                <p className="mt-1 text-xs text-emerald-600">60% de la utilidad neta de ventas</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 bg-blue-50/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">Total Pagado / Abonado</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">{currency.format(sumAdvisorPagado)}</p>
                <p className="mt-1 text-xs text-blue-600">{commissionPayments.length} transferencias/pagos registrados</p>
              </CardContent>
            </Card>

            <Card className={`border-l-4 ${sumAdvisorPendiente > 0 ? "border-l-amber-500 bg-amber-50/20" : "border-l-emerald-500 bg-emerald-50/20"}`}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Saldo Total Pendiente</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(sumAdvisorPendiente)}</p>
                <p className="mt-1 text-xs text-amber-700">Por liquidar a asesores comerciales</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Liquidación por Asesor */}
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Asesor Comercial</TableHead>
                  <TableHead className="text-right">Ventas Totales</TableHead>
                  <TableHead className="text-right">Utilidad Neta</TableHead>
                  <TableHead className="text-right font-bold text-emerald-800">Comisión 60%</TableHead>
                  <TableHead className="text-right">Pagado / Abonos</TableHead>
                  <TableHead className="text-right font-bold text-amber-800">Saldo Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.advisors.length ? (
                  data.advisors.map((adv) => {
                    const pendiente = Math.max(0, adv.comision_asesor - adv.comision_pagada);
                    return (
                      <tr key={adv.id_usuario} className="hover:bg-lf-surface-muted/60">
                        <TableCell>
                          <div className="font-bold text-lf-navy">{adv.asesor}</div>
                          <div className="text-xs text-lf-muted">{adv.cedula} · {adv.correo}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{currency.format(adv.total_ventas)}</TableCell>
                        <TableCell className="text-right font-medium text-lf-muted">{currency.format(adv.total_utilidad)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{currency.format(adv.comision_asesor)}</TableCell>
                        <TableCell className="text-right text-lf-navy">{currency.format(adv.comision_pagada)}</TableCell>
                        <TableCell className="text-right font-bold text-amber-700">{currency.format(pendiente)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              adv.estado_pago === "PAGADO"
                                ? "success"
                                : adv.estado_pago === "PENDIENTE"
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {adv.estado_pago === "PAGADO"
                              ? "Liquidado"
                              : adv.estado_pago === "PENDIENTE"
                              ? "Pendiente"
                              : "Sin ventas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {adv.comision_asesor > 0 ? (
                            <CommissionPaymentModal
                              advisors={advisorOptions}
                              defaultAdvisorId={adv.id_usuario}
                              triggerLabel="+ Abono"
                              compact
                            />
                          ) : (
                            <span className="text-xs text-lf-muted">—</span>
                          )}
                        </TableCell>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-lf-muted">
                      No hay registros de asesores para este período.
                    </TableCell>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-lf-surface-muted/80 font-bold">
                  <TableCell>TOTAL CONSOLIDADO ({data.advisors.length} Asesores)</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(sumAdvisorVentas)}</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(sumAdvisorUtilidad)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">{currency.format(sumAdvisorComision)}</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(sumAdvisorPagado)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-700">{currency.format(sumAdvisorPendiente)}</TableCell>
                  <TableCell colSpan={2}>—</TableCell>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>

          {/* Gráfico comparativo de comisiones vs abonos */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-lf-navy">Volumen de Facturación por Asesor</h3>
                  <p className="text-xs text-lf-muted">Participación en ventas brutas</p>
                </div>
              </div>
              <CardContent className="p-0 pt-4">
                <div className="space-y-4">
                  {chartAdvisorData.map((adv) => {
                    const maxVentas = Math.max(...chartAdvisorData.map((a) => a.total_ventas), 1);
                    const percent = (adv.total_ventas / maxVentas) * 100;
                    return (
                      <div key={adv.id_usuario} className="rounded-xl p-2 transition hover:bg-lf-surface-muted/60">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-lf-navy">{adv.asesor}</span>
                          <span className="font-mono font-bold text-blue-900">{currency.format(adv.total_ventas)}</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-lf-surface-muted overflow-hidden">
                          <div
                            style={{ width: `${Math.max(percent, 2)}%` }}
                            className="h-full rounded-full bg-blue-600 transition-all duration-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-lf-navy">Comisiones y Pagos por Asesor</h3>
                  <p className="text-xs text-lf-muted">Abonos Realizados vs. Saldo Pendiente</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-medium text-emerald-800">
                    <span className="size-2.5 rounded-full bg-emerald-600" /> Pagado
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-800">
                    <span className="size-2.5 rounded-full bg-amber-500" /> Pendiente
                  </span>
                </div>
              </div>
              <CardContent className="p-0 pt-4">
                <div className="space-y-4">
                  {chartAdvisorData.map((adv) => {
                    const comisionTotal = adv.comision_asesor;
                    const pagado = adv.comision_pagada;
                    const pendiente = Math.max(0, comisionTotal - pagado);
                    const percPagado = comisionTotal > 0 ? (pagado / comisionTotal) * 100 : 0;
                    const percPendiente = comisionTotal > 0 ? (pendiente / comisionTotal) * 100 : 0;

                    return (
                      <div key={adv.id_usuario} className="rounded-xl p-2 transition hover:bg-lf-surface-muted/60">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-lf-navy">{adv.asesor}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-700">Abonado: {currency.format(pagado)}</span>
                            <span className="text-lf-muted">·</span>
                            <span className="font-bold text-amber-700">Pendiente: {currency.format(pendiente)}</span>
                          </div>
                        </div>
                        <div className="flex h-3 w-full rounded-full bg-lf-surface-muted overflow-hidden">
                          {pagado > 0 && (
                            <div
                              style={{ width: `${percPagado}%` }}
                              className="h-full bg-emerald-600 transition-all duration-500"
                              title={`Pagado: ${currency.format(pagado)}`}
                            />
                          )}
                          {pendiente > 0 && (
                            <div
                              style={{ width: `${percPendiente}%` }}
                              className="h-full bg-amber-500 transition-all duration-500"
                              title={`Pendiente: ${currency.format(pendiente)}`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Historial de Abonos Realizados */}
          <div className="space-y-3 pt-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <History size={19} className="text-lf-terracotta" /> Historial de Abonos y Transferencias Realizadas
            </h3>
            {commissionPayments.length ? (
              <TableContainer>
                <Table>
                  <thead>
                    <tr>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Asesor Beneficiario</TableHead>
                      <TableHead>Forma de Pago</TableHead>
                      <TableHead>Nº Referencia</TableHead>
                      <TableHead>Observaciones</TableHead>
                      <TableHead>Registrado Por</TableHead>
                      <TableHead className="text-right">Monto Abonado</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionPayments.map((p) => (
                      <tr key={p.id_pago_comision} className="hover:bg-lf-surface-muted/60">
                        <TableCell className="whitespace-nowrap text-sm">
                          {dateFormatter.format(new Date(`${p.fecha}T12:00:00`))}
                        </TableCell>
                        <TableCell className="font-semibold text-lf-navy">{p.asesor}</TableCell>
                        <TableCell>
                          <Badge variant="neutral">{p.forma_pago}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-lf-muted">{p.referencia || "—"}</TableCell>
                        <TableCell className="text-sm text-lf-muted">{p.observaciones || "—"}</TableCell>
                        <TableCell className="text-xs text-lf-muted">{p.registrador}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{currency.format(p.monto)}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-lf-muted">
                  No se han registrado transferencias ni pagos parciales en este período.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: LIQUIDACIÓN LOCAL (40%) Y GASTOS */}
      {/* ========================================================= */}
      {activeTab === "LOCAL" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-lf-navy">
                <Store size={22} className="text-amber-600" /> Liquidación de Participación del Local (40%) vs. Gastos Deducidos
              </h2>
              <p className="text-sm text-lf-muted">
                Control financiero de la comisión asignada al local comercial y deducción de gastos fijos, operativos y de mejoras.
              </p>
            </div>
            <Link
              href="/gastos"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-lf-navy px-4 text-sm font-semibold text-white hover:bg-lf-navy-hover"
            >
              <Receipt size={17} /> Administrar gastos
            </Link>
          </div>

          {/* Tarjetas de Liquidación del Local */}
          <Card className="overflow-hidden border bg-lf-surface shadow-sm">
            <div className="grid divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">1. Ventas Totales Período</p>
                <p className="mt-2 text-2xl font-bold text-lf-navy">{currency.format(data.kpis.totalVentas)}</p>
                <p className="mt-1 text-xs text-lf-muted">Utilidad Bruta: {currency.format(data.kpis.utilidadBruta)}</p>
              </div>
              <div className="p-5 bg-amber-50/40">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">2. Comisión Local (40%)</p>
                <p className="mt-2 text-2xl font-bold text-amber-800">{currency.format(data.kpis.comisionesLocal)}</p>
                <p className="mt-1 text-xs text-amber-700">40% de la utilidad neta</p>
              </div>
              <div className="p-5 bg-rose-50/40">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-900">3. Gastos Deducidos (−)</p>
                <p className="mt-2 text-2xl font-bold text-rose-700">{currency.format(data.kpis.gastosOperativos)}</p>
                <p className="mt-1 text-xs text-rose-600">Pagados con la comisión del local</p>
              </div>
              <div className={`p-5 ${data.kpis.saldoComisionLocal >= 0 ? "bg-emerald-50/60" : "bg-red-50/60"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">4. Saldo Disponible (40% − Gastos)</p>
                <p className={`mt-2 text-2xl font-black ${data.kpis.saldoComisionLocal >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {currency.format(data.kpis.saldoComisionLocal)}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  {data.kpis.saldoComisionLocal >= 0 ? "✓ Saldo a favor del local" : "⚠ Déficit por gastos mayores a comisión"}
                </p>
              </div>
            </div>
          </Card>

          {/* Tabla de liquidación mes a mes del local */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-lf-navy">Detalle de Participación y Gastos Mes a Mes</h3>
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <TableHead>Período (Mes/Año)</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                    <TableHead className="text-right">Utilidad Neta</TableHead>
                    <TableHead className="text-right font-bold text-amber-800">Comisión Local 40%</TableHead>
                    <TableHead className="text-right text-rose-700">Gastos Deducidos</TableHead>
                    <TableHead className="text-right font-bold text-emerald-800">Saldo Disponible (40% − Gastos)</TableHead>
                    <TableHead>Estado</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.length ? (
                    data.monthlyBreakdown.map((m) => {
                      const saldo = m.saldo_comision_local ?? (m.comision_local - (m.gastos || 0));
                      return (
                        <tr key={m.year_month} className="hover:bg-lf-surface-muted/60">
                          <TableCell className="font-bold text-lf-navy">{m.label}</TableCell>
                          <TableCell className="text-right">{currency.format(m.total_ventas)}</TableCell>
                          <TableCell className="text-right text-lf-muted">{currency.format(m.utilidad)}</TableCell>
                          <TableCell className="text-right font-bold text-amber-700">{currency.format(m.comision_local)}</TableCell>
                          <TableCell className="text-right text-rose-700">{currency.format(m.gastos || 0)}</TableCell>
                          <TableCell className={`text-right font-bold ${saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {currency.format(saldo)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={saldo >= 0 ? "success" : "danger"}>
                              {saldo >= 0 ? "Superávit" : "Déficit"}
                            </Badge>
                          </TableCell>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-lf-muted">
                        No hay datos registrados para este período.
                      </TableCell>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-lf-surface-muted/80 font-bold">
                    <TableCell>TOTAL CONSOLIDADO</TableCell>
                    <TableCell className="text-right font-mono">{currency.format(sumMonthlyVentas)}</TableCell>
                    <TableCell className="text-right font-mono">{currency.format(sumMonthlyUtilidad)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-700">{currency.format(sumMonthlyComisionLocal)}</TableCell>
                    <TableCell className="text-right font-mono text-rose-700">{currency.format(sumMonthlyGastos)}</TableCell>
                    <TableCell className={`text-right font-mono ${sumMonthlySaldoLocal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {currency.format(sumMonthlySaldoLocal)}
                    </TableCell>
                    <TableCell>—</TableCell>
                  </tr>
                </tfoot>
              </Table>
            </TableContainer>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: EVOLUCIÓN MENSUAL Y ANUAL */}
      {/* ========================================================= */}
      {activeTab === "MENSUAL" && (
        <div className="space-y-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-lf-navy">
              <Calendar size={22} className="text-blue-600" /> Evolución Mensual y Anual de Operaciones
            </h2>
            <p className="text-sm text-lf-muted">
              Gráficos interactivos de ventas vs. compras, utilidad y consolidado mensual.
            </p>
          </div>

          {/* Gráficos Mensuales Interactivos */}
          <InteractiveReportsCharts
            monthlyData={chartMonthlyData}
            advisorData={chartAdvisorData}
          />

          {/* Tabla de Desglose Mensual */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-lf-navy">Consolidado Mensual de Ventas, Compras y Comisiones</h3>
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <TableHead>Período (Mes/Año)</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                    <TableHead className="text-right">Costo Mercadería</TableHead>
                    <TableHead className="text-right font-bold text-blue-900">Utilidad Neta</TableHead>
                    <TableHead className="text-right font-bold text-emerald-800">Comisión Asesores (60%)</TableHead>
                    <TableHead className="text-right font-bold text-amber-800">Comisión Local (40%)</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.length ? (
                    data.monthlyBreakdown.map((m) => (
                      <tr key={m.year_month} className="hover:bg-lf-surface-muted/60">
                        <TableCell className="font-bold text-lf-navy">{m.label}</TableCell>
                        <TableCell className="text-right font-mono">{m.unidades}</TableCell>
                        <TableCell className="text-right font-semibold">{currency.format(m.total_ventas)}</TableCell>
                        <TableCell className="text-right text-lf-muted">{currency.format(m.total_costo)}</TableCell>
                        <TableCell className="text-right font-bold text-blue-900">{currency.format(m.utilidad)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{currency.format(m.comision_asesores)}</TableCell>
                        <TableCell className="text-right font-bold text-amber-700">{currency.format(m.comision_local)}</TableCell>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-lf-muted">
                        No hay datos registrados en este período.
                      </TableCell>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-lf-surface-muted/80 font-bold">
                    <TableCell>TOTAL CONSOLIDADO</TableCell>
                    <TableCell className="text-right font-mono">{sumMonthlyUnidades}</TableCell>
                    <TableCell className="text-right font-mono">{currency.format(sumMonthlyVentas)}</TableCell>
                    <TableCell className="text-right font-mono text-lf-muted">{currency.format(sumMonthlyCostos)}</TableCell>
                    <TableCell className="text-right font-mono text-blue-900">{currency.format(sumMonthlyUtilidad)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-700">{currency.format(sumMonthlyComisionAsesores)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-700">{currency.format(sumMonthlyComisionLocal)}</TableCell>
                  </tr>
                </tfoot>
              </Table>
            </TableContainer>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 4: VENTAS POR TIPO DE PRODUCTO */}
      {/* ========================================================= */}
      {activeTab === "PRODUCTOS" && (
        <div className="space-y-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-lf-navy">
              <Layers size={22} className="text-purple-600" /> Rendimiento y Utilidad por Tipo de Producto
            </h2>
            <p className="text-sm text-lf-muted">
              Margen de ganancia, unidades vendidas y volumen de facturación por categoría y tipo de producto.
            </p>
          </div>

          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Tipo de Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Unidades Vendidas</TableHead>
                  <TableHead className="text-right">Ventas Totales</TableHead>
                  <TableHead className="text-right">Costo Total</TableHead>
                  <TableHead className="text-right font-bold text-blue-900">Utilidad Neta</TableHead>
                  <TableHead className="text-right font-bold text-emerald-700">% Margen</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.typeBreakdown.length ? (
                  data.typeBreakdown.map((t, idx) => (
                    <tr key={`${t.tipo}-${t.categoria}-${idx}`} className="hover:bg-lf-surface-muted/60">
                      <TableCell className="font-bold text-lf-navy">{t.tipo}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{t.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{t.unidades}</TableCell>
                      <TableCell className="text-right font-semibold">{currency.format(t.total_ventas)}</TableCell>
                      <TableCell className="text-right text-lf-muted">{currency.format(t.total_costo)}</TableCell>
                      <TableCell className="text-right font-bold text-blue-900">{currency.format(t.utilidad)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {t.total_ventas > 0 ? `${((t.utilidad / t.total_ventas) * 100).toFixed(1)}%` : "0%"}
                      </TableCell>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-lf-muted">
                      No hay datos de productos para este período.
                    </TableCell>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-lf-surface-muted/80 font-bold">
                  <TableCell colSpan={2}>TOTAL CONSOLIDADO</TableCell>
                  <TableCell className="text-right font-mono">{sumTypeUnidades}</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(sumTypeVentas)}</TableCell>
                  <TableCell className="text-right font-mono text-lf-muted">{currency.format(sumTypeCostos)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-900">{currency.format(sumTypeUtilidad)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">
                    {sumTypeVentas > 0 ? `${((sumTypeUtilidad / sumTypeVentas) * 100).toFixed(1)}%` : "0%"}
                  </TableCell>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}
