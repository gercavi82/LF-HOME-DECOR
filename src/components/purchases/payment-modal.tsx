"use client";

import { DollarSign, Plus, X, Save } from "lucide-react";
import { useState, useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { createPurchasePaymentAction, type PurchasePaymentActionState } from "@/app/(protected)/compras/actions";
import { Alert, Button, Input, Spinner } from "@/src/components/ui";
import { purchasePaymentSchema, type PurchasePaymentInput } from "@/src/lib/validation/purchases";

const initialState: PurchasePaymentActionState = {};

export function PurchasePaymentModal({
  purchases,
  defaultPurchaseId,
  triggerLabel,
  compact = false,
}: {
  purchases: Array<{ id_compra: number; numero_compra: string; proveedor: string; saldo_pendiente: number }>;
  defaultPurchaseId?: number;
  triggerLabel?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, serverPending] = useActionState(createPurchasePaymentAction, initialState);
  const [clientPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PurchasePaymentInput>({
    resolver: zodResolver(purchasePaymentSchema) as never,
    defaultValues: {
      id_compra: defaultPurchaseId || null,
      proveedor: purchases[0]?.proveedor || "Distribuidora Nacional de Blancos & Edredones",
      fecha: today,
      monto: 0,
      forma_pago: "Transferencia",
      referencia: "",
      observaciones: "",
    },
  });

  const isSuccess = Boolean(state.success);
  const isOpen = open && !isSuccess;

  const pending = serverPending || clientPending;

  const handleOpen = () => {
    if (defaultPurchaseId) setValue("id_compra", defaultPurchaseId);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const submit = handleSubmit((values) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""));
    }
    startTransition(async () => {
      formAction(formData);
      router.refresh();
    });
  });

  const buttonText = triggerLabel || (defaultPurchaseId || compact ? "+ Abono" : "+ Registrar depósito / abono");

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center justify-center whitespace-nowrap font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm ${
          compact || defaultPurchaseId
            ? "h-8 px-2.5 rounded-xl text-xs gap-1"
            : "h-9 px-3.5 rounded-xl text-xs gap-1.5"
        }`}
      >
        <Plus size={13} /> {buttonText}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lf-navy">Registrar Depósito / Abono a Proveedor</h3>
                  <p className="text-xs text-lf-muted">Se descontará directamente del saldo total pendiente con proveedores.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1 text-lf-muted hover:bg-lf-surface-muted hover:text-lf-navy"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

              {/* Proveedor */}
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Proveedor</span>
                <input
                  {...register("proveedor")}
                  placeholder="Distribuidora Nacional de Blancos & Edredones"
                  defaultValue="Distribuidora Nacional de Blancos & Edredones"
                  disabled={pending}
                  className="h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
                />
              </label>

              {/* Compra específica (opcional) */}
              {purchases.length > 0 ? (
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Factura / Pedido asociado (Opcional)</span>
                  <select
                    {...register("id_compra")}
                    disabled={pending}
                    className="h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta"
                  >
                    <option value="">Depósito General a Proveedor (Sin vincular a factura específica)</option>
                    {purchases.map((c) => (
                      <option key={c.id_compra} value={c.id_compra}>
                        {c.numero_compra} - {c.proveedor}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Fecha */}
                <Input
                  {...register("fecha")}
                  label="Fecha del abono"
                  type="date"
                  disabled={pending}
                  error={errors.fecha?.message || state.fieldErrors?.fecha}
                />

                {/* Monto */}
                <Input
                  {...register("monto")}
                  label="Monto abonado ($)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej: 150.00"
                  disabled={pending}
                  error={errors.monto?.message || state.fieldErrors?.monto}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Forma de Pago */}
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Forma de pago</span>
                  <select
                    {...register("forma_pago")}
                    disabled={pending}
                    className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:border-lf-terracotta"
                  >
                    <option value="Transferencia">Transferencia bancaria</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Depósito">Depósito</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </label>

                {/* Referencia */}
                <Input
                  {...register("referencia")}
                  label="Nº Comprobante / Referencia"
                  placeholder="Ej: Transf #10943"
                  disabled={pending}
                  error={errors.referencia?.message || state.fieldErrors?.referencia}
                />
              </div>

              {/* Observaciones */}
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Observaciones / Detalle (opcional)</span>
                <textarea
                  {...register("observaciones")}
                  rows={2}
                  placeholder="Ej: Abono 50% pedido edredones..."
                  disabled={pending}
                  className="w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-lf-terracotta"
                />
              </label>

              <div className="mt-6 flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={pending}
                  className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-lf-surface-muted"
                >
                  Cancelar
                </button>
                <Button type="submit" disabled={pending} className="h-10 bg-emerald-700 hover:bg-emerald-800">
                  {pending ? <Spinner label="Guardando..." /> : <><Save size={16} /> Guardar abono</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
