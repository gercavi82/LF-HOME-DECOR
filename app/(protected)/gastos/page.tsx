import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listExpenses, EXPENSE_CATEGORIES } from "@/src/services/expenses/expenses";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

const categoryBadgeVariants: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  FIJO: "neutral",
  VARIABLE: "warning",
  MARKETING: "success",
  OPERATIVO: "neutral",
  MEJORAS: "warning",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; categoria?: string; created?: string }>;
}) {
  const { mes = "", categoria = "", created } = await searchParams;
  const { expenses, summary } = await listExpenses({ month: mes, category: categoria });

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Control financiero"
        title="Gastos del negocio"
        description="Registro y desglose de gastos fijos, mejoras del local, publicidad y costos operativos."
        actions={
          <Link
            href="/gastos/nuevo"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"
          >
            <Plus size={18} /> Registrar gasto
          </Link>
        }
      />

      {created ? <Alert variant="success" className="mb-5">Gasto registrado correctamente.</Alert> : null}

      {/* Tarjetas de Resumen Financiero: Comisión del 40% vs Gastos Deducidos */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Comisión Local (40%)</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(summary.comisionLocal40)}</p>
            <p className="mt-1 text-xs text-lf-muted">40% de utilidad de ventas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Gastos Deducidos (−)</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">{currency.format(summary.total)}</p>
            <p className="mt-1 text-xs text-lf-muted">{summary.count} gasto(s) registrados</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.saldoComisionLocal >= 0 ? "border-l-emerald-600 bg-emerald-50/40" : "border-l-red-600 bg-red-50/40"}`}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">Saldo Neto Comisión 40%</p>
            <p className={`mt-1 text-2xl font-bold ${summary.saldoComisionLocal >= 0 ? "text-emerald-800" : "text-red-700"}`}>
              {currency.format(summary.saldoComisionLocal)}
            </p>
            <p className="mt-1 text-xs text-emerald-700 font-medium">Comisión 40% − Gastos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Gastos Fijos & Mejoras</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(summary.fijo + summary.mejoras)}</p>
            <p className="mt-1 text-xs text-lf-muted">Operativo & Mktg: {currency.format(summary.operativo + summary.marketing)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-lf-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/gastos"
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              !categoria ? "bg-lf-navy text-white" : "bg-lf-surface-muted text-lf-navy hover:bg-white"
            }`}
          >
            Todos
          </Link>
          {EXPENSE_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/gastos?categoria=${cat}${mes ? `&mes=${mes}` : ""}`}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                categoria === cat ? "bg-lf-navy text-white" : "bg-lf-surface-muted text-lf-navy hover:bg-white"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabla de Gastos */}
      {expenses.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </tr>
            </thead>
            <tbody>
              {expenses.map((gasto) => (
                <tr key={gasto.id_gasto} className="hover:bg-lf-surface-muted/60">
                  <TableCell className="whitespace-nowrap text-sm">
                    {dateFormatter.format(new Date(`${gasto.fecha}T12:00:00`))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={categoryBadgeVariants[gasto.categoria] || "neutral"}>
                      {gasto.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-lf-navy">
                    {gasto.descripcion}
                    {gasto.observaciones ? (
                      <p className="text-xs text-lf-muted">{gasto.observaciones}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-lf-muted">
                    {gasto.beneficiario || "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lf-navy">
                    {currency.format(gasto.monto)}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <Card>
          <CardContent className="grid min-h-64 place-items-center text-center">
            <div>
              <ReceiptText size={34} className="mx-auto text-lf-muted" />
              <p className="mt-3 font-semibold">No hay gastos registrados</p>
              <p className="mt-1 text-sm text-lf-muted">Registra los gastos fijos u operativos del local.</p>
              <Link
                href="/gastos/nuevo"
                className="mt-4 inline-flex items-center gap-2 font-semibold text-lf-terracotta"
              >
                <Plus size={17} /> Registrar gasto
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </ContentContainer>
  );
}
