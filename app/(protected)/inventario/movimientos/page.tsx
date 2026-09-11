import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, History } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listInventoryMovements } from "@/src/services/inventory/movements";

const incoming = new Set([
  "INICIAL",
  "ENTRADA_INICIAL",
  "COMPRA",
  "DEVOLUCION_CLIENTE",
  "DEVOLUCION_VENTA",
  "DEVOLUCION",
  "AJUSTE_ENTRADA",
  "AJUSTE_SOBRANTE",
  "CORRECCION_ENTRADA",
  "TRANSFERENCIA_ENTRADA",
  "ENTRADA",
]);

const labels: Record<string, string> = {
  INICIAL: "Inventario inicial",
  ENTRADA_INICIAL: "Inventario inicial",
  COMPRA: "Compra",
  VENTA: "Venta",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  DEVOLUCION_VENTA: "Devolución de venta",
  DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
  DEVOLUCION_COMPRA: "Devolución de compra",
  AJUSTE_ENTRADA: "Ajuste de entrada (+)",
  AJUSTE_SALIDA: "Ajuste de salida (−)",
  AJUSTE_SOBRANTE: "Ajuste por sobrante",
  AJUSTE_FALTANTE: "Ajuste por faltante",
  TRANSFERENCIA_ENTRADA: "Transferencia (entrada)",
  TRANSFERENCIA_SALIDA: "Transferencia (salida)",
  PERDIDA: "Pérdida",
  DANO: "Daño",
  CORRECCION_ENTRADA: "Corrección entrada",
  CORRECCION_SALIDA: "Corrección salida",
};
const dateFormatter = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" });

export default async function InventoryMovementsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const query = await searchParams;
  const movements = await listInventoryMovements();
  return <ContentContainer>
    <PageHeader eyebrow="Inventario" title="Movimientos" description="Historial transaccional de entradas y salidas de existencias." actions={<Link href="/inventario" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Volver</Link>} />
    {query.created ? <Alert variant="success" className="mb-5">Ajuste registrado correctamente. Movimiento #{query.created}.</Alert> : null}
    {movements.length ? <><TableContainer><Table><thead><tr><TableHead>Fecha</TableHead><TableHead>Producto / GS1</TableHead><TableHead>Bodega</TableHead><TableHead>Tipo</TableHead><TableHead>Cantidad</TableHead><TableHead>Stock</TableHead><TableHead>Responsable</TableHead></tr></thead><tbody>{movements.map((movement) => {
      const isIncoming = incoming.has(movement.tipo);
      return <tr key={movement.id_movimiento} className="hover:bg-lf-surface-muted/60"><TableCell className="whitespace-nowrap text-sm">{dateFormatter.format(new Date(movement.fecha))}</TableCell><TableCell><p className="font-semibold">{movement.producto}</p><p className="font-mono text-xs text-lf-muted">{movement.codigo_gs1}</p></TableCell><TableCell>{movement.bodega}</TableCell><TableCell><Badge variant={isIncoming ? "success" : "warning"}>{labels[movement.tipo] ?? movement.tipo}</Badge>{movement.motivo ? <p className="mt-1 max-w-48 truncate text-xs text-lf-muted" title={movement.motivo}>{movement.motivo}</p> : null}</TableCell><TableCell><span className={`inline-flex items-center gap-1 font-bold ${isIncoming ? "text-lf-success" : "text-lf-warning"}`}>{isIncoming ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}{isIncoming ? "+" : "−"}{movement.cantidad}</span></TableCell><TableCell className="whitespace-nowrap">{movement.stock_anterior} → <strong>{movement.stock_nuevo}</strong></TableCell><TableCell className="text-sm">{movement.responsable}</TableCell></tr>;
    })}</tbody></Table></TableContainer><p className="mt-3 text-sm text-lf-muted">Últimos {movements.length} movimientos.</p></> : <Card><CardContent className="grid min-h-64 place-items-center text-center"><div><History size={32} className="mx-auto text-lf-muted" /><p className="mt-3 font-semibold">Sin movimientos registrados</p><p className="mt-1 text-sm text-lf-muted">Las entradas y salidas aparecerán aquí.</p></div></CardContent></Card>}
  </ContentContainer>;
}
