import { Calendar, Filter, Receipt, RotateCcw, TrendingUp, Layers, History } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { getFinancialReport } from "@/src/services/reports/reports";
import { listCommissionPayments } from "@/src/services/commissions/commissions";
import { CommissionPaymentModal } from "@/src/components/commissions/payment-modal";
import { InteractiveReportsCharts } from "@/src/components/reports/interactive-charts";

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; tipo?: string }>;
}) {
  const { anio = "", mes = "", tipo = "" } = await searchParams;

  const [data, commissionPayments] = await Promise.all([
    getFinancialReport({
      year: anio,
      month: mes,
      tipoId: tipo,
    }),
    listCommissionPayments(),
  ]);

  const hasActiveFilters = Boolean(anio || mes || tipo);

  // Advisors list with remaining balance for payment modal
  const advisorOptions = data.advisors.map((a) => ({
    id_usuario: a.id_usuario,
    asesor: a.asesor,
    saldo_pendiente: Math.max(0, a.comision_asesor - a.comision_pagada),
  }));

  // Totales calculados por tabla individual
  const sumMonthlyUnidades = data.monthlyBreakdown.reduce((sum, m) => sum + m.unidades, 0);
  const sumMonthlyVentas = data.monthlyBreakdown.reduce((sum, m) => sum + m.total_ventas, 0);
  const sumMonthlyCostos = data.monthlyBreakdown.reduce((sum, m) => sum + m.total_costo, 0);
  const sumMonthlyUtilidad = data.monthlyBreakdown.reduce((sum, m) => sum + m.utilidad, 0);
  const sumMonthlyComisionAsesores = data.monthlyBreakdown.reduce((sum, m) => sum + m.comision_asesores, 0);
  const sumMonthlyComisionLocal = data.monthlyBreakdown.reduce((sum, m) => sum + m.comision_local, 0);

  const sumTypeUnidades = data.typeBreakdown.reduce((sum, t) => sum + t.unidades, 0);
  const sumTypeVentas = data.typeBreakdown.reduce((sum, t) => sum + t.total_ventas, 0);
  const sumTypeCostos = data.typeBreakdown.reduce((sum, t) => sum + t.total_costo, 0);
  const sumTypeUtilidad = data.typeBreakdown.reduce((sum, t) => sum + t.utilidad, 0);

  const sumAdvisorVentas = data.advisors.reduce((sum, a) => sum + a.total_ventas, 0);
  const sumAdvisorUtilidad = data.advisors.reduce((sum, a) => sum + a.total_utilidad, 0);
  const sumAdvisorComision = data.advisors.reduce((sum, a) => sum + a.comision_asesor, 0);
  const sumAdvisorPagado = data.advisors.reduce((sum, a) => sum + a.comision_pagada, 0);
  const sumAdvisorPendiente = data.advisors.reduce((sum, a) => sum + Math.max(0, a.comision_asesor - a.comision_pagada), 0);

  // Datos para los gráficos interactivos
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
    <ContentContainer>
      <PageHeader
        eyebrow="Consolidado financiero"
        title="Reportes y comisiones"
        description="Estado de resultados, gráficos interactivos, desglose por meses/años, tipos de productos y liquidación por asesor."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CommissionPaymentModal advisors={advisorOptions} />
            <Link
              href="/gastos"
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy"
            >
              <Receipt size={17} /> Ver gastos
            </Link>
          </div>
        }
      />

      {/* Barra de Filtros por Año, Mes y Tipo */}
      <form method="GET" className="mb-6 rounded-2xl border bg-lf-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Filtro Año */}
          <label className="block flex-1 min-w-[140px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Año
            </span>
            <select
              name="anio"
              defaultValue={anio}
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

          {/* Filtro Mes */}
          <label className="block flex-1 min-w-[160px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Mes
            </span>
            <select
              name="mes"
              defaultValue={mes}
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

          {/* Filtro Tipo de Producto */}
          <label className="block flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Tipo de producto
            </span>
            <select
              name="tipo"
              defaultValue={tipo}
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

          {/* Botones de acción */}
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

      {/* Tarjetas de Resumen Financiero Filtrado */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Ventas Totales</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(data.kpis.totalVentas)}</p>
            <p className="mt-1 text-xs text-lf-muted">{data.kpis.totalUnidades} unidades vendidas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Utilidad Bruta (Ventas − Costo)</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(data.kpis.utilidadBruta)}</p>
            <p className="mt-1 text-xs text-lf-muted">Costo mercadería: {currency.format(data.kpis.totalCostos)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Gastos Operativos & Local</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">{currency.format(data.kpis.gastosOperativos)}</p>
            <p className="mt-1 text-xs text-lf-muted">Fijos, mejoras y marketing</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Utilidad Neta Real</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(data.kpis.utilidadNetaReal)}</p>
            <p className="mt-1 text-xs text-emerald-600">Margen neto operativo</p>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN DE GRÁFICOS INTERACTIVOS */}
      <InteractiveReportsCharts
        monthlyData={chartMonthlyData}
        advisorData={chartAdvisorData}
      />

      {/* SECCIÓN 1: VENTAS POR MES Y AÑO */}
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <Calendar size={19} className="text-lf-terracotta" /> Ventas y Utilidad por Mes y Año
            </h2>
            <p className="text-sm text-lf-muted">Evolución mensual de ventas, costo de mercadería y comisiones generadas.</p>
          </div>
        </div>

        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Período (Mes / Año)</TableHead>
                <TableHead className="text-center">Unidades</TableHead>
                <TableHead className="text-right">Venta Total</TableHead>
                <TableHead className="text-right">Costo Mercadería</TableHead>
                <TableHead className="text-right">Utilidad Bruta</TableHead>
                <TableHead className="text-right">Comisión Asesores (60%)</TableHead>
                <TableHead className="text-right">Participación Local (40%)</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.monthlyBreakdown.map((m) => (
                <tr key={m.year_month} className="hover:bg-lf-surface-muted/60">
                  <TableCell className="font-semibold text-lf-navy">{m.label}</TableCell>
                  <TableCell className="text-center font-bold">{m.unidades}</TableCell>
                  <TableCell className="text-right font-medium text-lf-navy">{currency.format(m.total_ventas)}</TableCell>
                  <TableCell className="text-right text-lf-muted">{currency.format(m.total_costo)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{currency.format(m.utilidad)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">{currency.format(m.comision_asesores)}</TableCell>
                  <TableCell className="text-right font-medium text-lf-navy">{currency.format(m.comision_local)}</TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                <TableCell>TOTAL PERÍODOS</TableCell>
                <TableCell className="text-center">{sumMonthlyUnidades}</TableCell>
                <TableCell className="text-right text-lf-navy">{currency.format(sumMonthlyVentas)}</TableCell>
                <TableCell className="text-right text-lf-muted">{currency.format(sumMonthlyCostos)}</TableCell>
                <TableCell className="text-right text-amber-700">{currency.format(sumMonthlyUtilidad)}</TableCell>
                <TableCell className="text-right text-emerald-700">{currency.format(sumMonthlyComisionAsesores)}</TableCell>
                <TableCell className="text-right text-lf-navy">{currency.format(sumMonthlyComisionLocal)}</TableCell>
              </tr>
            </tfoot>
          </Table>
        </TableContainer>
      </div>

      {/* SECCIÓN 2: VENTAS POR TIPO DE PRODUCTO */}
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <Layers size={19} className="text-lf-terracotta" /> Ventas por Tipo de Producto
            </h2>
            <p className="text-sm text-lf-muted">Desglose de rendimiento por líneas de productos (Cobertores, Sábanas, Cubrecolchones, etc.).</p>
          </div>
        </div>

        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Tipo de Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-center">Unidades</TableHead>
                <TableHead className="text-right">Venta Total</TableHead>
                <TableHead className="text-right">Costo Estimado</TableHead>
                <TableHead className="text-right">Utilidad Generada</TableHead>
                <TableHead className="text-center">Margen %</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.typeBreakdown.map((t) => (
                <tr key={`${t.tipo}-${t.categoria}`} className="hover:bg-lf-surface-muted/60">
                  <TableCell className="font-semibold text-lf-navy">{t.tipo}</TableCell>
                  <TableCell className="text-sm text-lf-muted">{t.categoria}</TableCell>
                  <TableCell className="text-center font-bold">{t.unidades}</TableCell>
                  <TableCell className="text-right font-medium text-lf-navy">{currency.format(t.total_ventas)}</TableCell>
                  <TableCell className="text-right text-lf-muted">{currency.format(t.total_costo)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{currency.format(t.utilidad)}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      {t.margen_porcentaje}%
                    </span>
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                <TableCell colSpan={2}>TOTAL PRODUCTOS</TableCell>
                <TableCell className="text-center">{sumTypeUnidades}</TableCell>
                <TableCell className="text-right text-lf-navy">{currency.format(sumTypeVentas)}</TableCell>
                <TableCell className="text-right text-lf-muted">{currency.format(sumTypeCostos)}</TableCell>
                <TableCell className="text-right text-amber-700">{currency.format(sumTypeUtilidad)}</TableCell>
                <TableCell className="text-center">—</TableCell>
              </tr>
            </tfoot>
          </Table>
        </TableContainer>
      </div>

      {/* SECCIÓN 3: LIQUIDACIÓN DE COMISIONES POR ASESOR CON ABONOS */}
      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <TrendingUp size={19} className="text-lf-terracotta" /> Liquidación de Comisiones y Abonos por Asesor
            </h2>
            <p className="text-sm text-lf-muted">Comisión generada (60%), total abonado/pagado y saldo pendiente por liquidar.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border bg-emerald-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-emerald-800">Total Pagado: </span>
              <strong>{currency.format(sumAdvisorPagado)}</strong>
            </div>
            <div className="rounded-xl border bg-amber-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-amber-800">Saldo Pendiente: </span>
              <strong>{currency.format(sumAdvisorPendiente)}</strong>
            </div>
          </div>
        </div>

        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Asesor</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Utilidad</TableHead>
                <TableHead className="text-right">Comisión Total (60%)</TableHead>
                <TableHead className="text-right text-emerald-700">Total Pagado / Abonos</TableHead>
                <TableHead className="text-right text-amber-700">Saldo Pendiente</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.advisors.map((adv) => {
                const saldoPendiente = Math.max(0, adv.comision_asesor - adv.comision_pagada);
                return (
                  <tr key={adv.id_usuario} className="hover:bg-lf-surface-muted/60">
                    <TableCell>
                      <p className="font-semibold text-lf-navy">{adv.asesor}</p>
                      <p className="text-xs text-lf-muted">{adv.cedula} · {adv.correo}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium">{currency.format(adv.total_ventas)}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-700">{currency.format(adv.total_utilidad)}</TableCell>
                    <TableCell className="text-right font-bold text-lf-navy">{currency.format(adv.comision_asesor)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">{currency.format(adv.comision_pagada)}</TableCell>
                    <TableCell className="text-right font-bold text-amber-700">{currency.format(saldoPendiente)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={adv.estado_pago === "PAGADO" ? "success" : adv.comision_pagada > 0 ? "warning" : adv.comision_asesor > 0 ? "warning" : "neutral"}>
                        {adv.estado_pago === "PAGADO" ? "Liquidado" : adv.comision_pagada > 0 ? "Abono Parcial" : adv.comision_asesor > 0 ? "Pendiente" : "Sin ventas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <CommissionPaymentModal advisors={advisorOptions} defaultAdvisorId={adv.id_usuario} />
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                <TableCell>TOTAL CONSOLIDADO</TableCell>
                <TableCell className="text-right">{currency.format(sumAdvisorVentas)}</TableCell>
                <TableCell className="text-right text-amber-700">{currency.format(sumAdvisorUtilidad)}</TableCell>
                <TableCell className="text-right text-lf-navy">{currency.format(sumAdvisorComision)}</TableCell>
                <TableCell className="text-right text-emerald-700">{currency.format(sumAdvisorPagado)}</TableCell>
                <TableCell className="text-right text-amber-700">{currency.format(sumAdvisorPendiente)}</TableCell>
                <TableCell colSpan={2}>—</TableCell>
              </tr>
            </tfoot>
          </Table>
        </TableContainer>
      </div>

      {/* SECCIÓN 4: HISTORIAL DE ABONOS Y PAGOS REALIZADOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <History size={19} className="text-lf-terracotta" /> Historial de Abonos y Pagos de Comisiones Realizados
            </h2>
            <p className="text-sm text-lf-muted">Registro detallado de transferencias y abonos entregados a cada asesor.</p>
          </div>
        </div>

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
            <CardContent className="p-6 text-center text-sm text-lf-muted">
              No se han registrado abonos ni pagos parciales aún. Utilice el botón superior para ingresar el primer pago.
            </CardContent>
          </Card>
        )}
      </div>
    </ContentContainer>
  );
}
