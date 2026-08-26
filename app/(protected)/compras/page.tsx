import { ShoppingBag } from "lucide-react";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listPurchases } from "@/src/services/purchases/purchases";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; created?: string }>;
}) {
  const { mes = "" } = await searchParams;
  const { purchases, summary } = await listPurchases({ month: mes });

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Adquisición de mercadería"
        title="Historial de compras"
        description="Registro histórico de compras a proveedores con cantidades, costos unitarios e IVA."
      />

      {/* Tarjetas de Resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Total Compras</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(summary.total)}</p>
            <p className="mt-1 text-xs text-lf-muted">{summary.count} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Unidades Compradas</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{summary.unidades}</p>
            <p className="mt-1 text-xs text-lf-muted">Prendas / Artículos ingresados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Promedio por Compra</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(summary.promedio)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Proveedor Principal</p>
            <p className="mt-1 text-lg font-bold text-blue-900 truncate">Distribuidora Nacional</p>
            <p className="mt-1 text-xs text-lf-muted">Línea Edredones y Sábanas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Compras */}
      {purchases.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <TableHead>Nº Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Producto / Detalle</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
                  <TableCell className="text-sm text-lf-muted">
                    {compra.producto}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lf-navy">
                    {compra.unidades}
                  </TableCell>
                  <TableCell className="text-right text-sm text-lf-muted">
                    {currency.format(compra.subtotal)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-lf-muted">
                    {currency.format(compra.iva)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lf-navy">
                    {currency.format(compra.total)}
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-lf-navy bg-lf-surface-muted/30 font-bold">
                <TableCell colSpan={4}>TOTAL GENERAL COMPRAS</TableCell>
                <TableCell className="text-center">{summary.unidades}</TableCell>
                <TableCell className="text-right">{currency.format(summary.total / 1.15)}</TableCell>
                <TableCell className="text-right">{currency.format(summary.total - (summary.total / 1.15))}</TableCell>
                <TableCell className="text-right text-lf-terracotta">{currency.format(summary.total)}</TableCell>
              </tr>
            </tfoot>
          </Table>
        </TableContainer>
      ) : (
        <Card>
          <CardContent className="grid min-h-64 place-items-center text-center">
            <div>
              <ShoppingBag size={34} className="mx-auto text-lf-muted" />
              <p className="mt-3 font-semibold">No hay compras registradas</p>
              <p className="mt-1 text-sm text-lf-muted">Las compras importadas del consolidado aparecerán aquí.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </ContentContainer>
  );
}
