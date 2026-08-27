import { Filter, History, Plus, RotateCcw, Search, ShoppingBag, Edit2 } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listPurchases, listPurchasePayments } from "@/src/services/purchases/purchases";
import { PurchasePaymentModal } from "@/src/components/purchases/payment-modal";

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

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; tipo?: string; q?: string }>;
}) {
  const { anio = "", mes = "", tipo = "", q = "" } = await searchParams;

  const [{ purchases, summary, availableYears, availableTypes }, purchasePayments] = await Promise.all([
    listPurchases({
      year: anio,
      month: mes,
      tipoId: tipo,
      q,
    }),
    listPurchasePayments(),
  ]);

  const hasActiveFilters = Boolean(anio || mes || tipo || q);

  // Lista de compras para el modal de abonos
  const purchaseOptions = purchases.map((c) => ({
    id_compra: c.id_compra,
    numero_compra: c.numero_compra,
    proveedor: c.proveedor,
    saldo_pendiente: c.saldo_pendiente,
  }));

  // Totales calculados directamente sobre las filas de la tabla
  const sumUnidades = purchases.reduce((sum, p) => sum + p.unidades, 0);
  const sumSubtotal = purchases.reduce((sum, p) => sum + p.subtotal, 0);
  const sumIva = purchases.reduce((sum, p) => sum + p.iva, 0);
  const sumTotal = purchases.reduce((sum, p) => sum + p.total, 0);
  const sumPagado = purchases.reduce((sum, p) => sum + p.total_pagado, 0);
  const sumPendiente = purchases.reduce((sum, p) => sum + p.saldo_pendiente, 0);

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Adquisición de mercadería"
        title="Historial de compras"
        description="Registro histórico de compras a proveedores, abonos vinculados por fecha y saldos pendientes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/compras/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-lf-navy px-3 text-xs font-semibold text-white hover:bg-lf-navy-hover transition shadow-sm"
            >
              <Plus size={14} /> Nueva compra
            </Link>
            <PurchasePaymentModal purchases={purchaseOptions} />
          </div>
        }
      />

      {/* Tarjetas de Resumen de Compras y Abonos */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Total Compras</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(summary.total)}</p>
            <p className="mt-1 text-xs text-lf-muted">{summary.count} facturas / pedidos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Unidades Ingresadas</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{summary.unidades}</p>
            <p className="mt-1 text-xs text-lf-muted">Prendas y edredones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Pagado / Abonos</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(summary.totalPagado)}</p>
            <p className="mt-1 text-xs text-emerald-600">Abonos aplicados a compras</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Saldo Pendiente Proveedores</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(summary.totalPendiente)}</p>
            <p className="mt-1 text-xs text-amber-600">Por liquidar a proveedores</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros por Año, Mes, Tipo y Búsqueda */}
      <form method="GET" className="mb-6 rounded-2xl border bg-lf-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Búsqueda */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Buscar
            </span>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Nº compra o producto..."
                className="h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-lf-terracotta"
              />
            </div>
          </div>

          {/* Filtro Año */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Año
            </span>
            <select
              name="anio"
              defaultValue={anio}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Mes */}
          <div>
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
          </div>

          {/* Filtro Tipo de Producto */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Tipo de Producto
            </span>
            <select
              name="tipo"
              defaultValue={tipo}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los tipos</option>
              {availableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de acción */}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-lf-navy px-4 text-sm font-semibold text-white hover:bg-lf-navy-hover"
            >
              <Filter size={15} /> Filtrar
            </button>
            {hasActiveFilters ? (
              <Link
                href="/compras"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border bg-lf-surface-muted px-3 text-sm font-medium text-lf-muted hover:text-lf-navy"
                title="Limpiar filtros"
              >
                <RotateCcw size={15} /> Limpiar
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {/* Tabla de Compras con Abonos y Saldos */}
      {purchases.length ? (
        <>
          <TableContainer className="mb-8">
            <Table>
              <thead>
                <tr>
                  <TableHead>Nº Documento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Producto / Detalle</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total Compra</TableHead>
                  <TableHead className="text-right text-emerald-700">Total Pagado / Abonos</TableHead>
                  <TableHead className="text-right text-amber-700">Saldo Pendiente</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </tr>
              </thead>
              <tbody>
                {purchases.map((compra) => (
                  <tr key={compra.id_compra} className="hover:bg-lf-surface-muted/60">
                    <TableCell className="font-mono text-sm font-semibold text-lf-navy">
                      {compra.numero_compra}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {dateFormatter.format(new Date(`${compra.fecha}T12:00:00`))}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium text-lf-navy">{compra.proveedor}</p>
                    </TableCell>
                    <TableCell className="min-w-[260px] max-w-sm text-xs">
                      <div className="flex flex-wrap gap-1">
                        {compra.producto ? (
                          compra.producto.split(", ").map((item, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-800 shadow-2xs"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-lf-muted">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-lf-navy">
                      {compra.unidades}
                    </TableCell>
                    <TableCell className="text-right text-sm text-lf-muted font-mono">
                      {currency.format(compra.subtotal)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-lf-muted font-mono">
                      {currency.format(compra.iva)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-lf-navy font-mono">
                      {currency.format(compra.total)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700 font-mono">
                      {currency.format(compra.total_pagado)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-700 font-mono">
                      {currency.format(compra.saldo_pendiente)}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge variant={compra.estado_pago === "PAGADO" ? "success" : compra.estado_pago === "ABONO_PARCIAL" ? "warning" : "neutral"}>
                        {compra.estado_pago === "PAGADO" ? "Pagado" : compra.estado_pago === "ABONO_PARCIAL" ? "Abono Parcial" : "Por Pagar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/compras/${compra.id_compra}/editar`}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-lf-navy hover:bg-lf-surface-muted transition shadow-2xs"
                          title="Editar compra"
                        >
                          <Edit2 size={12} /> Editar
                        </Link>
                        <PurchasePaymentModal
                          purchases={purchaseOptions}
                          defaultPurchaseId={compra.id_compra}
                          compact
                        />
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                  <TableCell colSpan={4}>TOTAL GENERAL COMPRAS</TableCell>
                  <TableCell className="text-center">{sumUnidades}</TableCell>
                  <TableCell className="text-right text-lf-muted">{currency.format(sumSubtotal)}</TableCell>
                  <TableCell className="text-right text-lf-muted">{currency.format(sumIva)}</TableCell>
                  <TableCell className="text-right text-lf-navy">{currency.format(sumTotal)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{currency.format(sumPagado)}</TableCell>
                  <TableCell className="text-right text-amber-700">{currency.format(sumPendiente)}</TableCell>
                  <TableCell colSpan={2}>—</TableCell>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Card className="mb-8">
          <CardContent className="grid min-h-64 place-items-center text-center">
            <div>
              <ShoppingBag size={34} className="mx-auto text-lf-muted" />
              <p className="mt-3 font-semibold">No se encontraron compras</p>
              <p className="mt-1 text-sm text-lf-muted">Pruebe ajustando los filtros seleccionados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECCIÓN: HISTORIAL DE ABONOS Y PAGOS A PROVEEDORES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-lf-navy">
              <History size={19} className="text-lf-terracotta" /> Historial de Abonos y Pagos a Proveedores
            </h2>
            <p className="text-sm text-lf-muted">Registro detallado de transferencias y pagos aplicados a cada compra.</p>
          </div>
        </div>

        {purchasePayments.length ? (
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nº Compra</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Forma de Pago</TableHead>
                  <TableHead>Nº Referencia</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Registrado Por</TableHead>
                  <TableHead className="text-right">Monto Abonado</TableHead>
                </tr>
              </thead>
              <tbody>
                {purchasePayments.map((p) => (
                  <tr key={p.id_pago_compra} className="hover:bg-lf-surface-muted/60">
                    <TableCell className="whitespace-nowrap text-sm">
                      {dateFormatter.format(new Date(`${p.fecha}T12:00:00`))}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-lf-navy">{p.numero_compra}</TableCell>
                    <TableCell className="text-sm font-medium">{p.proveedor}</TableCell>
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
              No se han registrado abonos a proveedores todavía. Utilice el botón superior para ingresar un pago.
            </CardContent>
          </Card>
        )}
      </div>
    </ContentContainer>
  );
}
