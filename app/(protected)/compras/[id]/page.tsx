import { ArrowLeft, CheckCircle2, Clock, DollarSign, Edit2, FileText, Layers, Package, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { getPurchaseById, getPurchaseCatalogs } from "@/src/services/purchases/purchases";
import { PurchasePaymentModal } from "@/src/components/purchases/payment-modal";
import { getAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchaseId = Number(id);
  if (!purchaseId || isNaN(purchaseId)) notFound();

  const [purchase, catalogs, context] = await Promise.all([
    getPurchaseById(purchaseId),
    getPurchaseCatalogs(),
    getAuthContext(),
  ]);

  if (!purchase) notFound();

  const canEdit =
    context?.perfil === ROLE_NAMES.ADMINISTRADOR ||
    context?.permisos.some((p) => p.codigo === "COMPRA_EDITAR");

  let badgeVariant: "success" | "warning" | "danger" = "danger";
  let badgeLabel = "Pendiente de pago";
  if (purchase.estado_pago === "PAGADA") {
    badgeVariant = "success";
    badgeLabel = "Totalmente Pagada";
  } else if (purchase.estado_pago === "ABONO_PARCIAL") {
    badgeVariant = "warning";
    badgeLabel = "Abono Parcial";
  }

  const purchaseOption = [
    {
      id_compra: purchase.id_compra,
      id_proveedor: purchase.id_proveedor,
      numero_compra: purchase.numero_compra,
      proveedor: purchase.proveedor,
      saldo_pendiente: purchase.saldo_pendiente,
    },
  ];

  return (
    <ContentContainer>
      <div className="mb-4">
        <Link
          href="/compras"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-lf-muted hover:text-lf-navy transition"
        >
          <ArrowLeft size={16} /> Volver al historial de compras
        </Link>
      </div>

      <PageHeader
        eyebrow="Detalle de Compra / Factura"
        title={`Factura ${purchase.numero_compra}`}
        description={`Proveedor: ${purchase.proveedor} · Registrado el ${dateFormatter.format(new Date(purchase.fecha + "T12:00:00"))}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {purchase.saldo_pendiente > 0 ? (
              <PurchasePaymentModal
                purchases={purchaseOption}
                suppliers={catalogs.proveedores}
                defaultPurchaseId={purchase.id_compra}
                triggerLabel="+ Registrar Abono a esta Factura"
              />
            ) : null}
            {canEdit ? (
              <Link
                href={`/compras/${purchase.id_compra}/editar`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold text-lf-navy shadow-xs transition hover:bg-lf-surface-muted"
              >
                <Edit2 size={14} /> Editar compra
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Tarjetas de Resumen Financiero de la Compra */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-lf-navy">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Total Factura</p>
            <p className="mt-1 text-2xl font-bold text-lf-navy">{currency.format(purchase.total)}</p>
            <p className="mt-1 text-xs text-lf-muted">Subtotal: {currency.format(purchase.subtotal)} + IVA: {currency.format(purchase.iva)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Abonado / Pagado</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{currency.format(purchase.total_abonado)}</p>
            <p className="mt-1 text-xs text-emerald-600">{purchase.abonos_aplicados.length} depósito(s) aplicado(s)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Saldo Pendiente</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{currency.format(purchase.saldo_pendiente)}</p>
            <p className="mt-1 text-xs text-amber-600">Por liquidar al proveedor</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Estado de Pago</p>
            <div className="mt-2">
              <Badge variant={badgeVariant} className="text-xs px-2.5 py-1">
                {badgeLabel}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-lf-muted">Conciliación FIFO activa</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalle de Productos Comprados */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <h3 className="text-base font-bold text-lf-navy mb-3 flex items-center gap-2">
            <Package size={18} /> Mercadería Ingresada al Inventario
          </h3>
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <TableHead>Producto / Descripción</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Costo Unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item, idx) => (
                  <tr key={item.id_detalle_compra || idx} className="border-b last:border-0 hover:bg-lf-surface-muted/50">
                    <TableCell className="font-medium text-lf-navy">{item.descripcion}</TableCell>
                    <TableCell className="text-center font-bold">{item.cantidad} u</TableCell>
                    <TableCell className="text-right font-mono text-sm">{currency.format(item.precio_unitario)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{currency.format(item.subtotal)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{currency.format(item.iva)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-lf-navy">{currency.format(item.total)}</TableCell>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-lf-surface-muted/60 font-bold">
                  <TableCell>Totales</TableCell>
                  <TableCell className="text-center">{purchase.items.reduce((s, it) => s + it.cantidad, 0)} u</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(purchase.subtotal)}</TableCell>
                  <TableCell className="text-right font-mono">{currency.format(purchase.iva)}</TableCell>
                  <TableCell className="text-right font-mono text-lf-navy text-base">{currency.format(purchase.total)}</TableCell>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Historial de Abonos Aplicados a esta Factura */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-lf-navy flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-700" /> Historial de Abonos / Depósitos Aplicados a esta Factura
            </h3>
            <span className="text-xs text-lf-muted">Relación auditable N:M (FIFO)</span>
          </div>

          {purchase.abonos_aplicados.length > 0 ? (
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <TableHead>Fecha Depósito</TableHead>
                    <TableHead>Nº Referencia / Comprobante</TableHead>
                    <TableHead>Forma de Pago</TableHead>
                    <TableHead className="text-right">Monto Aplicado a esta Factura</TableHead>
                    <TableHead>Registrado Por</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {purchase.abonos_aplicados.map((ab) => (
                    <tr key={ab.id_aplicacion} className="border-b last:border-0 hover:bg-lf-surface-muted/50">
                      <TableCell className="font-medium text-sm">
                        {dateFormatter.format(new Date(ab.fecha_pago + "T12:00:00"))}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-lf-muted">
                        {ab.referencia || "Depósito bancario directo"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {ab.forma_pago}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-emerald-700">
                        {currency.format(ab.monto_aplicado)}
                      </TableCell>
                      <TableCell className="text-sm text-lf-muted">{ab.registrador}</TableCell>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50/50 font-bold">
                    <TableCell colSpan={3}>Total Abonos Aplicados</TableCell>
                    <TableCell className="text-right font-mono text-emerald-800 text-base">
                      {currency.format(purchase.total_abonado)}
                    </TableCell>
                    <TableCell>
                      {purchase.saldo_pendiente > 0 ? (
                        <span className="text-xs text-amber-700 font-semibold">
                          Saldo Restante: {currency.format(purchase.saldo_pendiente)}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700 font-semibold">
                          ✓ Pagada en su totalidad
                        </span>
                      )}
                    </TableCell>
                  </tr>
                </tfoot>
              </Table>
            </TableContainer>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center bg-lf-surface-muted/30">
              <Clock size={32} className="mx-auto text-lf-muted mb-2" />
              <p className="font-semibold text-lf-navy">Aún no se han aplicado depósitos a esta compra</p>
              <p className="text-xs text-lf-muted mt-1">
                Los depósitos registrados se asignan automáticamente en orden cronológico (FIFO).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </ContentContainer>
  );
}
