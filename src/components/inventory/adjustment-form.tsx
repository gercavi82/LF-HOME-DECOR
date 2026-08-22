"use client";

import { Calculator, Save } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { createAdjustmentAction, type AdjustmentState } from "@/app/(protected)/inventario/ajustes/actions";
import { Alert } from "@/src/components/ui";
import type { AdjustmentOption, StockOption, WarehouseOption } from "@/src/services/inventory/movements";

const initialState: AdjustmentState = {};
const movementTypes = [
  { value: "ENTRADA_INICIAL", label: "Entrada inicial", positive: true },
  { value: "AJUSTE_SOBRANTE", label: "Ajuste por sobrante", positive: true },
  { value: "AJUSTE_FALTANTE", label: "Ajuste por faltante", positive: false },
  { value: "PERDIDA", label: "Pérdida", positive: false },
  { value: "DANO", label: "Daño", positive: false },
  { value: "CORRECCION_ENTRADA", label: "Corrección de entrada", positive: true },
  { value: "CORRECCION_SALIDA", label: "Corrección de salida", positive: false },
] as const;

export function AdjustmentForm({ products, warehouses, stocks }: { products: AdjustmentOption[]; warehouses: WarehouseOption[]; stocks: StockOption[] }) {
  const [state, action, pending] = useActionState(createAdjustmentAction, initialState);
  const [variantId, setVariantId] = useState(0);
  const [warehouseId, setWarehouseId] = useState(0);
  const [type, setType] = useState<(typeof movementTypes)[number]["value"]>("AJUSTE_SOBRANTE");
  const [quantity, setQuantity] = useState(0);
  const currentStock = useMemo(() => stocks.find((stock) => stock.id_variante === variantId && stock.id_bodega === warehouseId)?.cantidad ?? 0, [stocks, variantId, warehouseId]);
  const positive = movementTypes.find((item) => item.value === type)?.positive ?? false;
  const projectedStock = currentStock + quantity * (positive ? 1 : -1);
  const inputClass = "h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20";

  return <form action={action} className="space-y-5">
    {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Producto / variante</span><select name="id_variante" required value={variantId || ""} onChange={(event) => setVariantId(Number(event.target.value))} className={inputClass}><option value="" disabled>Seleccione un producto</option>{products.map((product) => <option key={product.id_variante} value={product.id_variante}>{product.producto} · {product.codigo_gs1}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Bodega</span><select name="id_bodega" required value={warehouseId || ""} onChange={(event) => setWarehouseId(Number(event.target.value))} className={inputClass}><option value="" disabled>Seleccione una bodega</option>{warehouses.map((warehouse) => <option key={warehouse.id_bodega} value={warehouse.id_bodega}>{warehouse.nombre}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Tipo</span><select name="tipo" value={type} onChange={(event) => setType(event.target.value as typeof type)} className={inputClass}>{movementTypes.map((movement) => <option key={movement.value} value={movement.value}>{movement.label}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Cantidad</span><input name="cantidad" type="number" min="0.01" max="999999" step="0.01" required onChange={(event) => setQuantity(Number(event.target.value))} className={inputClass} /></label>
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Motivo</span><textarea name="motivo" minLength={5} maxLength={500} rows={4} required placeholder="Explique claramente la razón del ajuste..." className="w-full rounded-xl border bg-white px-3.5 py-2.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" /></label>
    </div>
    <div className="grid gap-3 rounded-2xl bg-lf-surface-muted p-4 sm:grid-cols-3"><div><p className="text-xs text-lf-muted">Stock actual</p><p className="mt-1 text-xl font-bold">{currentStock}</p></div><div><p className="text-xs text-lf-muted">Movimiento</p><p className={`mt-1 text-xl font-bold ${positive ? "text-lf-success" : "text-lf-warning"}`}>{positive ? "+" : "−"}{quantity || 0}</p></div><div><p className="text-xs text-lf-muted">Stock resultante</p><p className={`mt-1 text-xl font-bold ${projectedStock < 0 ? "text-lf-danger" : "text-lf-navy"}`}>{projectedStock}</p></div></div>
    {projectedStock < 0 ? <Alert variant="danger">El ajuste produciría stock negativo y será rechazado.</Alert> : null}
    <button disabled={pending || projectedStock < 0 || !variantId || !warehouseId} className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-5 text-sm font-semibold text-white hover:bg-lf-terracotta-hover disabled:opacity-50"><Save size={17} />{pending ? "Registrando..." : "Registrar ajuste"}</button>
    <p className="flex items-center gap-2 text-xs text-lf-muted"><Calculator size={15} /> La operación actualizará el stock y guardará la trazabilidad en una sola transacción.</p>
  </form>;
}
