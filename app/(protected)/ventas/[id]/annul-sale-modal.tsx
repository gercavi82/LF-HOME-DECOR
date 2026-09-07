"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";

import { Alert, Button, Modal } from "@/src/components/ui";
import { annulSaleAction } from "./actions";

interface AnnulSaleModalProps {
  saleId: number;
  saleNumber: string;
  isAnnulled: boolean;
}

export function AnnulSaleModal({ saleId, saleNumber, isAnnulled }: AnnulSaleModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isAnnulled) {
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 opacity-90">
        <Ban size={17} /> Venta Anulada
      </span>
    );
  }

  const handleAnnul = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await annulSaleAction(saleId, motivo.trim() || undefined);
      if (!res.success) {
        setErrorMessage(res.error || "No fue posible anular la venta.");
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMotivo("");
          setErrorMessage(null);
          setOpen(true);
        }}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100/90 shadow-sm"
      >
        <Ban size={17} /> Anular venta
      </button>

      <Modal
        open={open}
        title="Anular venta"
        description={`Venta ${saleNumber}`}
        onClose={() => !isPending && setOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle size={19} className="text-amber-600 shrink-0" />
              <span>¿Confirmas la anulación de esta venta?</span>
            </div>
            <ul className="mt-2.5 list-disc space-y-1 pl-5 text-xs text-amber-800/90 leading-relaxed">
              <li>El stock de todos los productos se <strong>reintegrará automáticamente</strong> al inventario.</li>
              <li>La venta quedará marcada como <strong>ANULADA</strong> y se excluirá de reportes, comisiones y balances.</li>
              <li>Quedará constancia de la anulación y el usuario responsable en la <strong>auditoría</strong>.</li>
            </ul>
          </div>

          <div>
            <label htmlFor="motivo-anulacion" className="block text-xs font-semibold text-lf-navy mb-1.5">
              Motivo de la anulación (opcional):
            </label>
            <textarea
              id="motivo-anulacion"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={isPending}
              placeholder="Ej. Error en forma de pago, devolución del cliente, duplicidad..."
              className="w-full rounded-xl border bg-white p-3 text-sm text-lf-navy placeholder:text-lf-muted focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-gray-100"
            />
          </div>

          {errorMessage && (
            <Alert variant="danger" title="Error al anular">
              {errorMessage}
            </Alert>
          )}

          <div className="mt-5 flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleAnnul}
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Ban size={16} />
                  Confirmar anulación
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
