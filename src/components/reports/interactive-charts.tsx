"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/src/components/ui";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export type ChartMonthlyItem = {
  year_month: string;
  label: string;
  total_ventas: number;
  total_compras: number;
  utilidad: number;
  comision_asesores: number;
};

export type ChartAdvisorItem = {
  id_usuario: number;
  asesor: string;
  total_ventas: number;
  total_utilidad: number;
  comision_asesor: number;
  comision_pagada: number;
  saldo_pendiente: number;
};

export function InteractiveReportsCharts({
  monthlyData,
  advisorData,
}: {
  monthlyData: ChartMonthlyItem[];
  advisorData: ChartAdvisorItem[];
}) {
  const [hoveredMonth, setHoveredMonth] = useState<ChartMonthlyItem | null>(null);
  const [hoveredAdvisor, setHoveredAdvisor] = useState<ChartAdvisorItem | null>(null);
  const [activeSeries, setActiveSeries] = useState<"ALL" | "VENTAS" | "COMPRAS">("ALL");

  // Si no hay datos mensuales o son pocos, crear estructura de 12 meses o mostrar los existentes
  const displayMonths = monthlyData.length ? monthlyData : [];

  // Máximo para escala de gráfico 1
  const maxMonthlyVal = Math.max(
    ...displayMonths.map((m) => Math.max(m.total_ventas, m.total_compras)),
    1000
  );

  // Máximo para escala de gráfico 2
  const maxUtilVal = Math.max(
    ...displayMonths.map((m) => Math.max(m.utilidad, m.comision_asesores)),
    500
  );

  // Máximo para ventas por asesor
  const maxAdvisorVentas = Math.max(...advisorData.map((a) => a.total_ventas), 500);

  return (
    <div className="mb-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
            <BarChart3 size={20} className="text-lf-terracotta" /> Gráficos Financieros Interactivos
          </h2>
          <p className="text-sm text-lf-muted">Comparativas dinámicas de ventas, compras, utilidades y liquidación por asesor.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* GRÁFICO 1: VENTAS Y COMPRAS POR MES */}
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-lf-navy">Ventas y Compras por Mes</h3>
              <p className="text-xs text-lf-muted">Comparativa de ingresos vs costo de adquisición</p>
            </div>
            {/* Controles interactivos */}
            <div className="flex items-center gap-1.5 rounded-xl border bg-lf-surface-muted/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveSeries("ALL")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  activeSeries === "ALL" ? "bg-white shadow-sm text-lf-navy" : "text-lf-muted hover:text-lf-navy"
                }`}
              >
                Ambos
              </button>
              <button
                type="button"
                onClick={() => setActiveSeries("VENTAS")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                  activeSeries === "VENTAS" ? "bg-blue-600 text-white shadow-sm" : "text-lf-muted hover:text-lf-navy"
                }`}
              >
                <span className="size-2 rounded-full bg-blue-500 inline-block" /> Ventas
              </button>
              <button
                type="button"
                onClick={() => setActiveSeries("COMPRAS")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                  activeSeries === "COMPRAS" ? "bg-amber-600 text-white shadow-sm" : "text-lf-muted hover:text-lf-navy"
                }`}
              >
                <span className="size-2 rounded-full bg-amber-500 inline-block" /> Compras
              </button>
            </div>
          </div>

          <CardContent className="p-0 pt-4">
            {displayMonths.length ? (
              <div className="space-y-3">
                {/* Visualizador de Barras Interactivas */}
                <div className="relative flex h-56 items-end gap-3 border-b pb-2 pt-6">
                  {displayMonths.map((m) => {
                    const hVentas = maxMonthlyVal > 0 ? (m.total_ventas / maxMonthlyVal) * 100 : 0;
                    const hCompras = maxMonthlyVal > 0 ? (m.total_compras / maxMonthlyVal) * 100 : 0;
                    const isHovered = hoveredMonth?.year_month === m.year_month;

                    return (
                      <div
                        key={m.year_month}
                        className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                        onMouseEnter={() => setHoveredMonth(m)}
                        onMouseLeave={() => setHoveredMonth(null)}
                      >
                        {/* Tooltip flotante */}
                        {isHovered && (
                          <div className="absolute -top-12 z-20 whitespace-nowrap rounded-xl bg-lf-navy px-3 py-1.5 text-xs text-white shadow-lg">
                            <p className="font-bold">{m.label}</p>
                            <p className="text-blue-200">Ventas: {currency.format(m.total_ventas)}</p>
                            <p className="text-amber-200">Compras: {currency.format(m.total_compras)}</p>
                          </div>
                        )}

                        {/* Contenedor de Barras */}
                        <div className="flex w-full items-end justify-center gap-1.5 h-full">
                          {(activeSeries === "ALL" || activeSeries === "VENTAS") && (
                            <div
                              style={{ height: `${Math.max(hVentas, 4)}%` }}
                              className={`w-full max-w-[20px] rounded-t-md transition-all duration-300 ${
                                isHovered ? "bg-blue-700 shadow-md scale-105" : "bg-blue-600/90"
                              }`}
                            />
                          )}
                          {(activeSeries === "ALL" || activeSeries === "COMPRAS") && (
                            <div
                              style={{ height: `${Math.max(hCompras, 4)}%` }}
                              className={`w-full max-w-[20px] rounded-t-md transition-all duration-300 ${
                                isHovered ? "bg-amber-600 shadow-md scale-105" : "bg-amber-500/90"
                              }`}
                            />
                          )}
                        </div>
                        <span className="mt-2 block truncate text-[11px] font-semibold text-lf-muted">
                          {m.label.split(" ")[0].slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Leyenda y detalles */}
                <div className="flex items-center justify-between pt-1 text-xs text-lf-muted">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium text-lf-navy">
                      <span className="size-3 rounded bg-blue-600" /> Ventas Totales
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-lf-navy">
                      <span className="size-3 rounded bg-amber-500" /> Compras / Stock
                    </span>
                  </div>
                  {hoveredMonth ? (
                    <span className="font-bold text-lf-navy">
                      {hoveredMonth.label}: Ventas {currency.format(hoveredMonth.total_ventas)} | Compras {currency.format(hoveredMonth.total_compras)}
                    </span>
                  ) : (
                    <span>Pase el cursor sobre las barras para ver detalles</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-lf-muted">No hay registros para graficar en este período.</p>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICO 2: EVOLUCIÓN DE UTILIDAD Y COMISIONES */}
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-lf-navy">Evolución de Utilidad y Comisiones</h3>
              <p className="text-xs text-lf-muted">Margen bruto (Naranja) vs. Comisión Asesores 60% (Verde)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-amber-700">
                <span className="size-2.5 rounded-full bg-amber-500" /> Utilidad
              </span>
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <span className="size-2.5 rounded-full bg-emerald-600" /> Comisión (60%)
              </span>
            </div>
          </div>

          <CardContent className="p-0 pt-4">
            {displayMonths.length ? (
              <div className="space-y-3">
                <div className="relative flex h-56 items-end gap-3 border-b pb-2 pt-6">
                  {displayMonths.map((m) => {
                    const hUtil = maxUtilVal > 0 ? (m.utilidad / maxUtilVal) * 100 : 0;
                    const hComis = maxUtilVal > 0 ? (m.comision_asesores / maxUtilVal) * 100 : 0;
                    const isHovered = hoveredMonth?.year_month === m.year_month;

                    return (
                      <div
                        key={m.year_month}
                        className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                        onMouseEnter={() => setHoveredMonth(m)}
                        onMouseLeave={() => setHoveredMonth(null)}
                      >
                        {isHovered && (
                          <div className="absolute -top-12 z-20 whitespace-nowrap rounded-xl bg-lf-navy px-3 py-1.5 text-xs text-white shadow-lg">
                            <p className="font-bold">{m.label}</p>
                            <p className="text-amber-300">Utilidad: {currency.format(m.utilidad)}</p>
                            <p className="text-emerald-300">Comisión: {currency.format(m.comision_asesores)}</p>
                          </div>
                        )}

                        <div className="flex w-full items-end justify-center gap-1.5 h-full">
                          <div
                            style={{ height: `${Math.max(hUtil, 4)}%` }}
                            className={`w-full max-w-[18px] rounded-t-md transition-all duration-300 ${
                              isHovered ? "bg-amber-600 shadow-md scale-105" : "bg-amber-500/90"
                            }`}
                          />
                          <div
                            style={{ height: `${Math.max(hComis, 4)}%` }}
                            className={`w-full max-w-[18px] rounded-t-md transition-all duration-300 ${
                              isHovered ? "bg-emerald-700 shadow-md scale-105" : "bg-emerald-600/90"
                            }`}
                          />
                        </div>
                        <span className="mt-2 block truncate text-[11px] font-semibold text-lf-muted">
                          {m.label.split(" ")[0].slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-lf-muted">
                  <span>Margen de utilidad promedio: 32.7% sobre venta</span>
                  {hoveredMonth ? (
                    <span className="font-bold text-emerald-800">
                      Utilidad: {currency.format(hoveredMonth.utilidad)} | Comisión: {currency.format(hoveredMonth.comision_asesores)}
                    </span>
                  ) : (
                    <span>Pase el cursor para ver el desglose</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-lf-muted">No hay datos en este período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FILA 2 DE GRÁFICOS: ASESORES */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GRÁFICO 3: VENTAS POR ASESOR */}
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-lf-navy">Ventas por Asesor Comercial</h3>
              <p className="text-xs text-lf-muted">Volumen total de facturación por vendedor</p>
            </div>
            <div className="rounded-xl border bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
              Total Asesores: {advisorData.length}
            </div>
          </div>

          <CardContent className="p-0 pt-4">
            {advisorData.length ? (
              <div className="space-y-4">
                {advisorData.map((adv) => {
                  const percent = maxAdvisorVentas > 0 ? (adv.total_ventas / maxAdvisorVentas) * 100 : 0;
                  const isHovered = hoveredAdvisor?.id_usuario === adv.id_usuario;

                  return (
                    <div
                      key={adv.id_usuario}
                      className="group cursor-pointer rounded-xl p-2 transition hover:bg-lf-surface-muted/60"
                      onMouseEnter={() => setHoveredAdvisor(adv)}
                      onMouseLeave={() => setHoveredAdvisor(null)}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-lf-navy">{adv.asesor}</span>
                        <span className="font-mono font-bold text-blue-900">{currency.format(adv.total_ventas)}</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-lf-surface-muted overflow-hidden">
                        <div
                          style={{ width: `${Math.max(percent, 2)}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHovered ? "bg-blue-600 scale-y-110" : "bg-blue-500"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-lf-muted">No hay ventas registradas por asesores.</p>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICO 4: LIQUIDACIÓN Y ABONOS POR ASESOR */}
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-lf-navy">Comisiones y Pagos por Asesor</h3>
              <p className="text-xs text-lf-muted">Comparativa de Abonos Realizados vs. Saldo Pendiente</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-emerald-800">
                <span className="size-2.5 rounded-full bg-emerald-600" /> Pagado / Abono
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-800">
                <span className="size-2.5 rounded-full bg-amber-500" /> Saldo Pendiente
              </span>
            </div>
          </div>

          <CardContent className="p-0 pt-4">
            {advisorData.length ? (
              <div className="space-y-4">
                {advisorData.map((adv) => {
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

                      {/* Barra apilada interactiva */}
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
            ) : (
              <p className="py-12 text-center text-sm text-lf-muted">No hay comisiones registradas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
