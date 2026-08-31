import { Eye, History, Plus, ReceiptText, Search, Filter, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listSales } from "@/src/services/sales/sales";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "short",
  timeStyle: "short",
});

const PAGE_SIZE = 7;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; asesor?: string; local?: string; mes?: string; page?: string; created?: string }>;
}) {
  const { q = "", asesor = "", local = "", mes = "", page = "1", created } = await searchParams;

  const { sales, summary, advisors, locales, count, context } = await listSales({
    q,
    asesorId: asesor,
    localId: local,
    mes,
  });

  const canCreate =
    context.perfil === "Administrador" ||
    context.permisos.some((permission) => permission.codigo === "VENTA_CREAR");

  const hasActiveFilters = Boolean(q || asesor || local || mes);

  // Cálculo de paginación de 7 en 7
  const totalItems = sales.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedSales = sales.slice(startIndex, endIndex);

  const createPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (asesor) params.set("asesor", asesor);
    if (local) params.set("local", local);
    if (mes) params.set("mes", mes);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return qs ? `/ventas?${qs}` : "/ventas";
  };

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Operación comercial"
        title="Ventas"
        description="Consulta las ventas registradas, liquidación de comisiones (60/40) y filtros por asesor o local."
        actions={
          <div className="flex gap-2">
            <Link
              href="/ventas/historial"
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"
            >
              <History size={18} /> Historial
            </Link>
            {canCreate ? (
              <Link
                href="/ventas/nueva"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"
              >
                <Plus size={18} /> Nueva venta
              </Link>
            ) : null}
          </div>
        }
      />

      {created ? <Alert variant="success" className="mb-5">Venta {created} registrada correctamente.</Alert> : null}

      {/* Tarjetas de Resumen de Comisiones */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Ventas Totales</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(summary.totalVentas)}</p>
            <p className="mt-1 text-xs text-lf-muted">{summary.totalUnidades} unidades en {count} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Comisión Asesor (60%)</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(summary.totalComisionAsesor)}</p>
            <p className="mt-1 text-xs text-emerald-600">60% de la utilidad neta</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.saldoComisionLocal >= 0 ? "border-l-amber-500 bg-amber-50/20" : "border-l-red-500 bg-red-50/20"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Comisión Local (40%)</p>
              <Badge variant={summary.saldoComisionLocal >= 0 ? "success" : "danger"}>
                Saldo: {currency.format(summary.saldoComisionLocal)}
              </Badge>
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(summary.totalComisionLocal)}</p>
            <p className="mt-1 text-xs text-amber-800">
              40% ({currency.format(summary.totalComisionLocal)}) − Gastos ({currency.format(summary.totalGastos)}) = Saldo para cuadrar: <span className="font-bold">{currency.format(summary.saldoComisionLocal)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Utilidad Bruta Ventas</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{currency.format(summary.totalUtilidad)}</p>
            <p className="mt-1 text-xs text-lf-muted">
              {summary.totalVentas > 0 ? ((summary.totalUtilidad / summary.totalVentas) * 100).toFixed(1) : 0}% de margen real
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de Filtros Interactivos */}
      <form method="GET" className="mb-5 rounded-2xl border bg-lf-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Búsqueda por texto */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Buscar
            </span>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Nº venta o cliente..."
                className="h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-lf-terracotta"
              />
            </div>
          </div>

          {/* Filtro Asesor */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Asesor / Vendedor
            </span>
            <select
              name="asesor"
              defaultValue={asesor}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los asesores</option>
              {advisors.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Local */}
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lf-muted">
              Local
            </span>
            <select
              name="local"
              defaultValue={local}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
            >
              <option value="">Todos los locales</option>
              {locales.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.nombre}
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
                href="/ventas"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border bg-lf-surface-muted px-3 text-sm font-medium text-lf-muted hover:text-lf-navy"
                title="Limpiar filtros"
              >
                <RotateCcw size={15} /> Limpiar
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {/* Tabla de Ventas con Comisiones 60/40 */}
      {sales.length ? (
        <>
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Venta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Asesor / Vendedor</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Venta Total</TableHead>
                  <TableHead className="text-right">Comisión Asesor (60%)</TableHead>
                  <TableHead className="text-right">Comisión Local (40%)</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((sale) => (
                  <tr key={sale.id_venta} className="hover:bg-lf-surface-muted/60">
                    <TableCell className="font-mono text-sm font-semibold text-lf-navy">
                      {sale.numero_venta}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-lf-muted">
                      {dateFormatter.format(new Date(sale.fecha))}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-lf-navy">{sale.vendedor}</p>
                      <p className="text-xs text-lf-muted">{sale.cliente}</p>
                    </TableCell>
                    <TableCell className="text-sm text-lf-muted">{sale.local}</TableCell>
                    <TableCell className="text-center font-bold">{sale.unidades}</TableCell>
                    <TableCell className="text-right font-bold text-lf-navy">
                      {currency.format(sale.total)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">
                      {currency.format(sale.comision_asesor)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-700">
                      {currency.format(sale.comision_local)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sale.estado === "REGISTRADA" ? "success" : sale.estado === "ANULADA" ? "danger" : "neutral"}>
                        {sale.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/ventas/${sale.id_venta}`}
                        title="Ver detalle"
                        className="inline-grid size-9 place-items-center rounded-lg border bg-white text-lf-navy hover:border-lf-terracotta"
                      >
                        <Eye size={16} />
                        <span className="sr-only">Ver detalle de {sale.numero_venta}</span>
                      </Link>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                  <TableCell colSpan={4}>TOTAL FILTRADO ({totalItems} ventas)</TableCell>
                  <TableCell className="text-center">{summary.totalUnidades}</TableCell>
                  <TableCell className="text-right text-lf-navy">{currency.format(summary.totalVentas)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{currency.format(summary.totalComisionAsesor)}</TableCell>
                  <TableCell className="text-right text-amber-700">{currency.format(summary.totalComisionLocal)}</TableCell>
                  <TableCell colSpan={2}>—</TableCell>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>

          {/* Barra de Paginación de 7 en 7 */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-lf-surface p-3 shadow-sm">
            <p className="text-xs text-lf-muted">
              Mostrando <span className="font-bold text-lf-navy">{startIndex + 1}</span> a <span className="font-bold text-lf-navy">{endIndex}</span> de <span className="font-bold text-lf-navy">{totalItems}</span> ventas registradas
            </p>

            {totalPages > 1 ? (
              <div className="flex items-center gap-1.5">
                <Link
                  href={createPageUrl(currentPage - 1)}
                  aria-disabled={currentPage <= 1}
                  className={`inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition ${
                    currentPage <= 1
                      ? "pointer-events-none border border-transparent bg-lf-surface-muted text-lf-muted/40"
                      : "border bg-white text-lf-navy hover:bg-lf-surface-muted shadow-sm"
                  }`}
                >
                  <ChevronLeft size={15} /> Anterior
                </Link>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    if (
                      p === 1 ||
                      p === totalPages ||
                      (p >= currentPage - 1 && p <= currentPage + 1)
                    ) {
                      const isCurrent = p === currentPage;
                      return (
                        <Link
                          key={p}
                          href={createPageUrl(p)}
                          className={`grid size-9 place-items-center rounded-xl text-xs font-bold transition ${
                            isCurrent
                              ? "bg-lf-navy text-white shadow-sm"
                              : "border bg-white text-lf-navy hover:bg-lf-surface-muted shadow-sm"
                          }`}
                        >
                          {p}
                        </Link>
                      );
                    }
                    if (p === currentPage - 2 || p === currentPage + 2) {
                      return <span key={p} className="px-1 text-xs text-lf-muted">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Link
                  href={createPageUrl(currentPage + 1)}
                  aria-disabled={currentPage >= totalPages}
                  className={`inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition ${
                    currentPage >= totalPages
                      ? "pointer-events-none border border-transparent bg-lf-surface-muted text-lf-muted/40"
                      : "border bg-white text-lf-navy hover:bg-lf-surface-muted shadow-sm"
                  }`}
                >
                  Siguiente <ChevronRight size={15} />
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="grid min-h-64 place-items-center text-center">
            <div>
              <ReceiptText size={34} className="mx-auto text-lf-muted" />
              <p className="mt-3 font-semibold">No se encontraron ventas</p>
              <p className="mt-1 text-sm text-lf-muted">Pruebe ajustando los filtros seleccionados.</p>
              {canCreate ? (
                <Link href="/ventas/nueva" className="mt-4 inline-flex items-center gap-2 font-semibold text-lf-terracotta">
                  <Plus size={17} /> Nueva venta
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </ContentContainer>
  );
}

