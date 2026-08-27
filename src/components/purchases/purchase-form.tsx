"use client";

import { useState, useActionState, useTransition } from "react";
import { Plus, Trash2, Save, ShoppingCart, Calculator, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { createPurchaseAction, updatePurchaseAction, type PurchaseActionState } from "@/app/(protected)/compras/actions";
import { Alert, Button, Input, Spinner } from "@/src/components/ui";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export type PurchaseItemLine = {
  id_variante: number;
  cantidad: number;
  precio_unitario: number;
  porcentaje_iva: number;
};

export type PurchaseFormCatalogs = {
  proveedores: Array<{ id: number; nombre: string; ruc_cedula: string }>;
  variantes: Array<{ id_variante: number; descripcion: string; codigo_interno: string; precio_venta: number }>;
};

export type PurchaseFormDefaults = {
  id_compra?: number;
  id_proveedor?: number;
  numero_compra?: string;
  fecha?: string;
  observaciones?: string | null;
  items?: Array<{
    id_variante: number;
    cantidad: number;
    precio_unitario: number;
    porcentaje_iva: number;
  }>;
};

const initialState: PurchaseActionState = {};

export function PurchaseForm({
  catalogs,
  defaults,
}: {
  catalogs: PurchaseFormCatalogs;
  defaults?: PurchaseFormDefaults;
}) {
  const editing = Boolean(defaults?.id_compra);
  const [state, formAction, serverPending] = useActionState(
    editing ? updatePurchaseAction : createPurchaseAction,
    initialState
  );
  const [clientPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const [idProveedor, setIdProveedor] = useState<number>(defaults?.id_proveedor || catalogs.proveedores[0]?.id || 1);
  const [numeroCompra, setNumeroCompra] = useState<string>(defaults?.numero_compra || "");
  const [fecha, setFecha] = useState<string>(defaults?.fecha || today);
  const [observaciones, setObservaciones] = useState<string>(defaults?.observaciones || "");

  const [items, setItems] = useState<PurchaseItemLine[]>(
    defaults?.items && defaults.items.length > 0
      ? defaults.items
      : [
          {
            id_variante: catalogs.variantes[0]?.id_variante || 1,
            cantidad: 10,
            precio_unitario: 15.0,
            porcentaje_iva: 15,
          },
        ]
  );

  const pending = serverPending || clientPending;

  const addItem = () => {
    setItems([
      ...items,
      {
        id_variante: catalogs.variantes[0]?.id_variante || 1,
        cantidad: 10,
        precio_unitario: 15.0,
        porcentaje_iva: 15,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseItemLine, val: number) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: val,
    };
    setItems(updated);
  };

  // Totales en vivo
  const totalUnidades = items.reduce((sum, it) => sum + (Number(it.cantidad) || 0), 0);
  const totalSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
    0
  );
  const totalIva = items.reduce(
    (sum, it) =>
      sum + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0) * ((Number(it.porcentaje_iva) || 0) / 100),
    0
  );
  const totalGeneral = totalSubtotal + totalIva;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    if (editing && defaults?.id_compra) {
      formData.set("id_compra", String(defaults.id_compra));
    }
    formData.set("id_proveedor", String(idProveedor));
    formData.set("numero_compra", numeroCompra.trim());
    formData.set("fecha", fecha);
    formData.set("observaciones", observaciones.trim());
    formData.set("items_json", JSON.stringify(items));

    startTransition(async () => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-lf-navy flex items-center gap-2">
          <ShoppingCart size={18} className="text-lf-terracotta" /> Datos de la Compra / Factura
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Proveedor */}
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Proveedor</span>
            <select
              value={idProveedor}
              onChange={(e) => setIdProveedor(Number(e.target.value))}
              disabled={pending}
              className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:border-lf-terracotta"
            >
              {catalogs.proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.ruc_cedula ? `(${p.ruc_cedula})` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Nº Factura / Compra */}
          <Input
            label="Nº Documento / Factura"
            value={numeroCompra}
            onChange={(e) => setNumeroCompra(e.target.value)}
            placeholder="Ej: 001-001-000012345"
            disabled={pending}
            error={state.fieldErrors?.numero_compra}
          />

          {/* Fecha */}
          <Input
            label="Fecha de la compra"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={pending}
            error={state.fieldErrors?.fecha}
          />
        </div>

        {/* Observaciones */}
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Observaciones / Notas (opcional)</span>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Detalle adicional del pedido o entrega..."
            disabled={pending}
            className="w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-lf-terracotta"
          />
        </label>
      </div>

      {/* DETALLE DE PRODUCTOS */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-lf-navy flex items-center gap-2">
              <Calculator size={18} className="text-lf-terracotta" /> Productos Adquiridos
            </h3>
            <p className="text-xs text-lf-muted">Seleccione las variantes y especifique cantidad y costo unitario sin IVA.</p>
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-lf-navy px-3 text-xs font-semibold text-white hover:bg-lf-navy-hover transition"
          >
            <Plus size={14} /> Agregar producto
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-lf-surface-muted/50 text-xs font-semibold uppercase text-lf-muted">
              <tr>
                <th className="p-3">Producto / Variante</th>
                <th className="p-3 w-28 text-center">Cantidad</th>
                <th className="p-3 w-36 text-right">Costo Unit. ($)</th>
                <th className="p-3 w-24 text-center">IVA %</th>
                <th className="p-3 w-32 text-right">Subtotal</th>
                <th className="p-3 w-32 text-right">Total c/IVA</th>
                <th className="p-3 w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, idx) => {
                const sub = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
                const iva = sub * ((Number(item.porcentaje_iva) || 0) / 100);
                const tot = sub + iva;

                return (
                  <tr key={idx} className="hover:bg-lf-surface-muted/30">
                    <td className="p-2">
                      <select
                        value={item.id_variante}
                        onChange={(e) => updateItem(idx, "id_variante", Number(e.target.value))}
                        disabled={pending}
                        className="h-10 w-full rounded-xl border bg-white px-2.5 text-sm outline-none focus:border-lf-terracotta"
                      >
                        {catalogs.variantes.map((v) => (
                          <option key={v.id_variante} value={v.id_variante}>
                            {v.descripcion} {v.codigo_interno ? `[${v.codigo_interno}]` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.cantidad || ""}
                        onChange={(e) => updateItem(idx, "cantidad", Math.max(1, Number(e.target.value)))}
                        disabled={pending}
                        className="h-10 w-full rounded-xl border bg-white px-2 text-center text-sm font-bold text-lf-navy outline-none focus:border-lf-terracotta"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.precio_unitario || ""}
                        onChange={(e) => updateItem(idx, "precio_unitario", Math.max(0, Number(e.target.value)))}
                        disabled={pending}
                        className="h-10 w-full rounded-xl border bg-white px-2 text-right text-sm outline-none focus:border-lf-terracotta"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={item.porcentaje_iva}
                        onChange={(e) => updateItem(idx, "porcentaje_iva", Number(e.target.value))}
                        disabled={pending}
                        className="h-10 w-full rounded-xl border bg-white px-2 text-center text-xs outline-none focus:border-lf-terracotta"
                      />
                    </td>
                    <td className="p-2 text-right font-mono text-sm text-lf-muted">
                      {currency.format(sub)}
                    </td>
                    <td className="p-2 text-right font-mono text-sm font-bold text-lf-navy">
                      {currency.format(tot)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={pending || items.length <= 1}
                        className="rounded-lg p-1.5 text-lf-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"
                        title="Eliminar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RESUMEN DE TOTALES */}
        <div className="mt-4 flex flex-col items-end gap-1.5 border-t pt-4 text-sm">
          <div className="flex w-64 justify-between text-lf-muted">
            <span>Total Prendas / Unidades:</span>
            <strong className="text-lf-navy">{totalUnidades} u</strong>
          </div>
          <div className="flex w-64 justify-between text-lf-muted">
            <span>Subtotal sin IVA:</span>
            <span className="font-mono">{currency.format(totalSubtotal)}</span>
          </div>
          <div className="flex w-64 justify-between text-lf-muted">
            <span>IVA (15%):</span>
            <span className="font-mono">{currency.format(totalIva)}</span>
          </div>
          <div className="flex w-64 justify-between border-t pt-2 text-base font-bold text-lf-navy">
            <span>Total Compra:</span>
            <span className="font-mono text-emerald-800">{currency.format(totalGeneral)}</span>
          </div>
        </div>
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex items-center justify-between border-t pt-4">
        <Link
          href="/compras"
          className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-medium hover:bg-lf-surface-muted"
        >
          <ArrowLeft size={16} /> Cancelar y volver
        </Link>
        <Button type="submit" disabled={pending} className="h-11 px-6 bg-emerald-700 hover:bg-emerald-800">
          {pending ? (
            <Spinner label="Guardando compra..." />
          ) : (
            <>
              <Save size={17} /> {editing ? "Actualizar compra" : "Guardar compra en inventario"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
