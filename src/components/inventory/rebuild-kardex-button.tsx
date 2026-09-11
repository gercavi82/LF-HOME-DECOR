"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, Modal } from "@/src/components/ui";
import { reconcileKardexAction } from "@/app/(protected)/inventario/actions";

export function RebuildKardexButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();

  const handleReconcile = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await reconcileKardexAction();
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setTimeout(() => {
          setIsOpen(false);
          router.refresh();
        }, 1800);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
      >
        <RefreshCw size={14} /> Reconciliar Kardex ahora
      </button>

      <Modal
        open={isOpen}
        onClose={() => !isPending && setIsOpen(false)}
        title="Reconciliación Histórica de Kardex"
        description="Alinea los movimientos históricos con el saldo físico actual."
      >
        <div className="space-y-4 text-sm text-lf-navy">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-blue-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold">Operación Segura y Atómica</p>
                <ul className="mt-1.5 list-disc pl-4 space-y-1 text-xs text-blue-800">
                  <li>Crea respaldo automático de las tablas de inventario antes de modificar.</li>
                  <li>Registra los movimientos de <strong>INICIAL</strong> y <strong>COMPRA</strong> faltantes.</li>
                  <li>Recalcula cronológicamente los saldos (stock anterior / stock nuevo).</li>
                  <li><strong>NO reduce ni altera el stock físico actual</strong> de los productos.</li>
                  <li>Si algún saldo no coincide con precisión absoluta, revierte automáticamente.</li>
                </ul>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`rounded-xl border p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleReconcile}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Reconciliando Kardex...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Iniciar Reconciliación
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
