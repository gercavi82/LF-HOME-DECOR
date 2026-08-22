"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import { ImagePlus, Save } from "lucide-react";

import { createProductAction, updateProductAction, type ProductActionState } from "@/app/(protected)/productos/actions";
import { Alert } from "@/src/components/ui";
import type { ProductCatalogs } from "@/src/services/products/products";
import { Gs1Scanner } from "@/src/components/products/gs1-scanner";
import { gs1ValidationMessage, normalizeGs1 } from "@/src/lib/gs1";
import { calculateIncludedTax } from "@/src/lib/tax";

type ProductDefaults = Record<string, string | number | boolean | null>;
const initialState: ProductActionState = {};

function SelectField({ label, name, options, value }: { label: string; name: string; options: Array<{ id: number; nombre: string }>; value?: number }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span><select name={name} required defaultValue={value ?? ""} className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"><option value="" disabled>Seleccionar</option>{options.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select></label>;
}

export function ProductForm({ catalogs, defaults }: { catalogs: ProductCatalogs; defaults?: ProductDefaults }) {
  const editing = Boolean(defaults?.id_producto);
  const [state, action, pending] = useActionState(editing ? updateProductAction : createProductAction, initialState);
  const [price, setPrice] = useState(Number(defaults?.precio_venta ?? 0));
  const tax = Number(defaults?.porcentaje_iva ?? catalogs.defaultTaxRate);
  const [gs1, setGs1] = useState(String(defaults?.codigo_gs1 ?? ""));
  const normalizedGs1 = normalizeGs1(gs1);
  const gs1Error = gs1 ? gs1ValidationMessage(gs1) : undefined;
  const handleDetected = useCallback((value: string) => setGs1(value), []);
  const calculation = useMemo(() => calculateIncludedTax(price, tax), [price, tax]);
  const inputClass = "h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20";

  return <form action={action} className="space-y-6" encType="multipart/form-data">
    {editing ? <input type="hidden" name="id_producto" value={String(defaults?.id_producto)} /> : null}
    {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Descripción</span><input name="descripcion" required maxLength={250} defaultValue={String(defaults?.descripcion ?? "")} className={inputClass} /></label>
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Detalle</span><textarea name="detalle" rows={3} maxLength={1000} defaultValue={String(defaults?.detalle ?? "")} className="w-full rounded-xl border bg-white px-3.5 py-2.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" /></label>
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Código GS1 (opcional)</span><span className="flex gap-2"><input name="codigo_gs1" inputMode="numeric" autoComplete="off" maxLength={50} value={gs1} onChange={(event) => setGs1(event.target.value)} aria-invalid={Boolean(gs1Error)} className={inputClass} /><Gs1Scanner onDetected={handleDetected} /></span>{gs1Error ? <span className="mt-1.5 block text-xs text-lf-danger">{gs1Error}</span> : normalizedGs1 ? <span className="mt-1.5 block text-xs text-lf-success">Código GS1 válido.</span> : null}<span className="mt-1 block text-xs text-lf-muted">Ingrese un GTIN/UPC/EAN oficial cuando el producto lo tenga.</span></label>
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Código interno</span><input value={String(defaults?.codigo_interno ?? "Se generará al guardar según categoría y tipo")} readOnly className={`${inputClass} bg-lf-surface-muted font-mono`} /><span className="mt-1 block text-xs text-lf-muted">Obligatorio, único e inmutable. También funciona con el escáner.</span></label>
      <SelectField label="Categoría" name="id_categoria" options={catalogs.categorias} value={Number(defaults?.id_categoria) || undefined} />
      <SelectField label="Tipo" name="id_tipo" options={catalogs.tipos} value={Number(defaults?.id_tipo) || undefined} />
      <SelectField label="Marca" name="id_marca" options={catalogs.marcas} value={Number(defaults?.id_marca) || undefined} />
      <SelectField label="Material" name="id_material" options={catalogs.materiales} value={Number(defaults?.id_material) || undefined} />
      <SelectField label="Tamaño" name="id_tamano" options={catalogs.tamanos} value={Number(defaults?.id_tamano) || undefined} />
      <SelectField label="Color" name="id_color" options={catalogs.colores} value={Number(defaults?.id_color) || undefined} />
      <SelectField label="Diseño" name="id_diseno" options={catalogs.disenos} value={Number(defaults?.id_diseno) || undefined} />
      <SelectField label="Unidad" name="id_unidad" options={catalogs.unidades} value={Number(defaults?.id_unidad) || undefined} />
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Precio final incluido IVA</span><input name="precio_venta" type="number" min="0.01" max="999999.99" step="0.01" required defaultValue={price || ""} onChange={(event) => setPrice(Number(event.target.value))} className={inputClass} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">IVA aplicado</span><input value={`${tax.toFixed(2)}%`} readOnly className={`${inputClass} bg-lf-surface-muted`} /><input name="porcentaje_iva" type="hidden" value={tax} /><span className="mt-1 block text-xs text-lf-muted">Definido por los parámetros del sistema.</span></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Stock mínimo</span><input name="stock_minimo" type="number" min="0" step="0.01" required defaultValue={Number(defaults?.stock_minimo ?? 5)} className={inputClass} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Imagen</span><span className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3.5 text-sm text-lf-muted"><ImagePlus size={18} /><input name="imagen" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="min-w-0 flex-1 text-xs" /></span></label>
    </div>
    <div className="grid gap-3 rounded-2xl bg-lf-surface-muted p-4 sm:grid-cols-3"><div><p className="text-xs text-lf-muted">Subtotal sin IVA</p><p className="mt-1 font-semibold">${calculation.subtotal.toFixed(2)}</p></div><div><p className="text-xs text-lf-muted">IVA ({calculation.rate.toFixed(2)}%)</p><p className="mt-1 font-semibold">${calculation.tax.toFixed(2)}</p></div><div><p className="text-xs text-lf-muted">Total incluido IVA</p><p className="mt-1 font-semibold text-lf-terracotta">${calculation.total.toFixed(2)}</p></div></div>
    <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-5 text-sm font-semibold text-white hover:bg-lf-terracotta-hover disabled:opacity-60"><Save size={17} />{pending ? "Guardando..." : editing ? "Guardar cambios" : "Crear producto"}</button>
  </form>;
}
