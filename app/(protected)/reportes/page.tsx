import { Receipt } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { getCommissionsSummary } from "@/src/services/commissions/commissions";
import { listExpenses } from "@/src/services/expenses/expenses";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes = "" } = await searchParams;

  const [{ advisors, totals: commTotals }, { summary: expSummary }] = await Promise.all([
    getCommissionsSummary(mes),
    listExpenses({ month: mes }),
  ]);

  // Cálculos Financieros Consolidados
  const totalVentas = commTotals.ventas;
  const totalCostosMercaderia = commTotals.costos;
  const utilidadBruta = commTotals.utilidad;
  const totalGastosOperativos = expSummary.total;
  const utilidadNetaReal = utilidadBruta - totalGastosOperativos;

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Consolidado financiero"
        title="Reportes y comisiones"
        description="Estado de resultados, comisiones por asesor (60% / 40%) y utilidad neta real del negocio."
        actions={
          <div className="flex gap-2">
            <Link
              href="/gastos"
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy"
            >
              <Receipt size={17} /> Ver gastos
            </Link>
          </div>
        }
      />

      {/* Tarjetas de Resumen Financiero */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Ventas Totales</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(totalVentas)}</p>
            <p className="mt-1 text-xs text-lf-muted">{commTotals.unidades} unidades vendidas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Utilidad Bruta (Ventas − Costo)</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(utilidadBruta)}</p>
            <p className="mt-1 text-xs text-lf-muted">Costo mercadería: {currency.format(totalCostosMercaderia)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Gastos Operativos & Local</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">{currency.format(totalGastosOperativos)}</p>
            <p className="mt-1 text-xs text-lf-muted">Fijos, mejoras y marketing</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Utilidad Neta Real</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(utilidadNetaReal)}</p>
            <p className="mt-1 text-xs text-emerald-600">Margen neto operativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Sección de Comisiones de Asesores */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-lf-navy">Liquidación de Comisiones por Asesor</h2>
            <p className="text-sm text-lf-muted">Participación del 60% para el Asesor y 40% para el Local sobre la utilidad generada.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border bg-lf-surface px-3 py-1.5 text-xs">
              <span className="font-semibold text-emerald-700">Pagado: </span>
              <strong>{currency.format(commTotals.pagado)}</strong>
            </div>
            <div className="rounded-xl border bg-amber-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-amber-800">Pendiente: </span>
              <strong>{currency.format(commTotals.pendiente)}</strong>
            </div>
          </div>
        </div>

        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Asesor</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Utilidad</TableHead>
                <TableHead className="text-right">Local (40%)</TableHead>
                <TableHead className="text-right">Asesor (60%)</TableHead>
                <TableHead className="text-center">Unidades</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </tr>
            </thead>
            <tbody>
              {advisors.map((adv) => (
                <tr key={adv.id_usuario} className="hover:bg-lf-surface-muted/60">
                  <TableCell>
                    <p className="font-semibold text-lf-navy">{adv.asesor}</p>
                    <p className="text-xs text-lf-muted">{adv.cedula} · {adv.correo}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium">{currency.format(adv.total_ventas)}</TableCell>
                  <TableCell className="text-right text-lf-muted">{currency.format(adv.total_costo)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{currency.format(adv.total_utilidad)}</TableCell>
                  <TableCell className="text-right font-medium text-lf-navy">{currency.format(adv.comision_local)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">{currency.format(adv.comision_asesor)}</TableCell>
                  <TableCell className="text-center">{adv.unidades_vendidas}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={adv.estado_pago === "PAGADO" ? "success" : adv.estado_pago === "PENDIENTE" ? "warning" : "neutral"}>
                      {adv.estado_pago === "PAGADO" ? "Pagado" : adv.estado_pago === "PENDIENTE" ? "Pendiente" : "Sin ventas"}
                    </Badge>
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                <TableCell>TOTAL CONSOLIDADO</TableCell>
                <TableCell className="text-right">{currency.format(commTotals.ventas)}</TableCell>
                <TableCell className="text-right text-lf-muted">{currency.format(commTotals.costos)}</TableCell>
                <TableCell className="text-right text-amber-700">{currency.format(commTotals.utilidad)}</TableCell>
                <TableCell className="text-right text-lf-navy">{currency.format(commTotals.comision_local)}</TableCell>
                <TableCell className="text-right text-emerald-700">{currency.format(commTotals.comision_asesor)}</TableCell>
                <TableCell className="text-center">{commTotals.unidades}</TableCell>
                <TableCell className="text-center">—</TableCell>
              </tr>
            </tfoot>
          </Table>
        </TableContainer>
      </div>
    </ContentContainer>
  );
}
