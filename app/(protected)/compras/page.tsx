import { CheckCircle2, Eye, Filter, History, Layers, Plus, RotateCcw, Search, ShoppingBag, Edit2, Wallet } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listPurchases, listPurchasePayments, getPurchaseCatalogs } from "@/src/services/purchases/purchases";
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
  searchParams: Promise<{ anio?: string; mes?: string; tipo?: string; q?: string; auto_abono?: string; created?: string; updated?: string }>;
}) {
  const { anio = "", mes = "", tipo = "", q = "", auto_abono, created, updated } = await searchParams;

  const [{ purchases, summary, availableYears, availableTypes }, purchasePayments, catalogs] = await Promise.all([
    listPurchases({
      year: anio,
      month: mes,
      tipoId: tipo,
      q,
    }),
    listPurchasePayments(),
    getPurchaseCatalogs(),
  ]);

  const hasActiveFilters = Boolean(anio || mes || tipo || q);

  // Lista de compras para el modal de abonos
  const purchaseOptions = purchases.map((c) => ({
    id_compra: c.id_compra,
    id_proveedor: c.id_proveedor,
    numero_compra: c.numero_compra,
    proveedor: c.proveedor,
    saldo_pendiente: c.saldo_pendiente,
  }));

  // Totales calculados directamente sobre las filas de la tabla
  const sumUnidades = purchases.reduce((sum, p) => sum + p.unidades, 0);
  const sumTotal = purchases.reduce((sum, p) => sum + p.total, 0);
  const sumPagado = purchases.reduce((sum, p) => sum + p.total_pagado, 0);
  const sumPendiente = purchases.reduce((sum, p) => sum + p.saldo_pendiente, 0);

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Adquisición de mercadería"
        title="Historial de compras"
        description="Registro histórico de compras a proveedores, cruce FIFO de abonos y saldos pendientes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/compras/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-lf-navy px-3 text-xs font-semibold text-white hover:bg-lf-navy-hover transition shadow-sm"
            >
              <Plus size={14} /> Nueva compra
            </Link>
            <PurchasePaymentModal
              purchases={purchaseOptions}
              suppliers={catalogs.proveedores}
              triggerLabel="Registrar depósito / abono"
            />
          </div>
        }
      />

      {/* Alerta de Abono Automático aplicado al crear compra */}
      {auto_abono ? (
        <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950 shadow-sm flex items-start gap-3 animate-in fade-in">
          <CheckCircle2 size={22} className="mt-0.5 text-emerald-700 shrink-0" />
          <div>
            <p className="font-bold text-base">¡Compra registrada exitosamente!</p>
            <p className="text-sm mt-0.5">
              Esta compra recibió automáticamente un abono de <strong>{currency.format(Number(auto_abono))}</strong> proveniente de depósitos disponibles del proveedor (Conciliación FIFO).
            </p>
          </div>
        </div>
      ) : null}

      {/* Tarjetas de Resumen Financiero y Cruce FIFO */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Total Compras</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(summary.total)}</p>
            <p className="mt-1 text-xs text-lf-muted">{summary.count} facturas / pedidos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Depósitos / Abonos</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(summary.totalPagado)}</p>
            <p className="mt-1 text-xs text-emerald-600">Transferencias y pagos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-600 bg-teal-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Total Aplicado (FIFO)</p>
            <p className="mt-1 text-2xl font-bold text-teal-700">{currency.format(summary.totalAplicado)}</p>
            <p className="mt-1 text-xs text-teal-600">Cruzado en compras</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 bg-blue-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Depósitos Disponibles</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{currency.format(summary.depositosDisponibles)}</p>
            <p className="mt-1 text-xs text-blue-600">Saldo a favor de compras</p>
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

      {/* Tabla de Compras */}
      {purchases.length ? (
        <>
          <TableContainer className="mb-8">
            <Table>
              <thead>
                <tr>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Producto / Detalle</TableHead>
                  <TableHead className="text-right font-bold">Total Factura</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Saldo Pendiente</TableHead>
                  <TableHead className="text-center">Estado de Pago</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </tr>
              </thead>
              <tbody>
                {purchases.map((compra) => {
                  let badgeVariant: "success" | "warning" | "danger" = "danger";
                  let badgeText = "Pendiente";
                  if (compra.estado_pago === "PAGADA") {
                    badgeVariant = "success";
                    badgeText = "Pagada";
                  } else if (compra.estado_pago === "ABONO_PARCIAL") {
                    badgeVariant = "warning";
                    badgeText = "Abono Parcial";
                  }

                  return (
                    <tr key={compra.id_compra} className="hover:bg-lf-surface-muted/60">
                      <TableCell className="font-mono text-sm font-semibold text-lf-navy">
                        <Link href={`/compras/${compra.id_compra}`} className="hover:underline flex items-center gap-1">
                          {compra.numero_compra}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {dateFormatter.format(new Date(`${compra.fecha}T12:00:00`))}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-lf-navy">
                        {compra.proveedor}
                      </TableCell>
                      <TableCell className="min-w-[240px] max-w-sm text-xs">
                        <div className="flex flex-col gap-1 py-1">
                          {compra.producto ? (
                            compra.producto.split(/\s*\|\s*/).map((item, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-xs font-medium text-slate-800"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-lf-muted">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-lf-navy font-mono text-sm">
                        {currency.format(compra.total)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-emerald-700 font-mono font-medium">
                        {currency.format(compra.total_pagado)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono font-bold">
                        {compra.saldo_pendiente > 0 ? (
                          <span className="text-amber-700">{currency.format(compra.saldo_pendiente)}</span>
                        ) : (
                          <span className="text-emerald-600">$0,00</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={badgeVariant} className="text-xs px-2 py-0.5">
                            {badgeText}
                          </Badge>
                          {compra.estado_pago === "ABONO_PARCIAL" ? (
                            <span className="text-[10px] text-lf-muted">
                              Abonado: {currency.format(compra.total_pagado)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/compras/${compra.id_compra}`}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-lf-navy hover:bg-lf-surface-muted transition shadow-2xs"
                            title="Ver detalle de la compra y abonos"
                          >
                            <Eye size={13} /> Ver
                          </Link>
                          <Link
                            href={`/compras/${compra.id_compra}/editar`}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-lf-muted hover:text-lf-navy hover:bg-lf-surface-muted transition shadow-2xs"
                            title="Editar compra"
                          >
                            <Edit2 size={13} />
                          </Link>
                          {compra.saldo_pendiente > 0 ? (
                            <PurchasePaymentModal
                              purchases={purchaseOptions}
                              suppliers={catalogs.proveedores}
                              defaultPurchaseId={compra.id_compra}
                              compact
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                  <TableCell colSpan={4}>TOTAL GENERAL FACTURAS DE COMPRA</TableCell>
                  <TableCell className="text-right text-lf-navy font-mono text-base">{currency.format(sumTotal)}</TableCell>
                  <TableCell className="text-right text-emerald-700 font-mono text-base">{currency.format(sumPagado)}</TableCell>
                  <TableCell className="text-right text-amber-700 font-mono text-base">{currency.format(sumPendiente)}</TableCell>
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
              <History size={19} className="text-lf-terracotta" /> Historial de Depósitos y Abonos a Proveedores
            </h2>
            <p className="text-sm text-lf-muted">Registro de depósitos con monto original, monto aplicado por FIFO y saldo disponible.</p>
          </div>
        </div>

        {purchasePayments.length ? (
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto Depósito</TableHead>
                  <TableHead className="text-right">Monto Aplicado</TableHead>
                  <TableHead className="text-right">Saldo Disponible</TableHead>
                  <TableHead>Forma de Pago</TableHead>
                  <TableHead>Nº Referencia</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Registrado Por</TableHead>
                </tr>
              </thead>
              <tbody>
                {purchasePayments.map((p) => (
                  <tr key={p.id_pago_compra} className="hover:bg-lf-surface-muted/60">
                    <TableCell className="whitespace-nowrap text-sm">
                      {dateFormatter.format(new Date(`${p.fecha}T12:00:00`))}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-lf-navy">{p.proveedor}</TableCell>
                    <TableCell className="text-right font-bold text-lf-navy font-mono text-sm">
                      {currency.format(p.monto)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700 font-mono text-sm">
                      {currency.format(p.monto_aplicado)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {p.saldo_disponible > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          <Wallet size={12} /> {currency.format(p.saldo_disponible)}
                        </span>
                      ) : (
                        <span className="text-xs text-lf-muted">Agotado ($0,00)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{p.forma_pago}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-lf-muted">{p.referencia || "—"}</TableCell>
                    <TableCell className="text-sm text-lf-muted">{p.observaciones || "—"}</TableCell>
                    <TableCell className="text-xs text-lf-muted">{p.registrador}</TableCell>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-lf-surface-muted/40 font-bold border-t">
                  <TableCell colSpan={2}>TOTAL DEPÓSITOS</TableCell>
                  <TableCell className="text-right font-mono text-lf-navy text-sm">
                    {currency.format(purchasePayments.reduce((s, p) => s + p.monto, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-700 text-sm">
                    {currency.format(purchasePayments.reduce((s, p) => s + p.monto_aplicado, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-700 text-sm">
                    {currency.format(purchasePayments.reduce((s, p) => s + p.saldo_disponible, 0))}
                  </TableCell>
                  <TableCell colSpan={4}>—</TableCell>
                </tr>
              </tfoot>
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
