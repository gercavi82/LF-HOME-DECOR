"use server";

import { revalidatePath } from "next/cache";
import { rebuildInventoryKardex } from "@/src/services/inventory/rebuild-kardex";
import { publicError } from "@/src/lib/errors";

export async function reconcileKardexAction() {
  try {
    const result = await rebuildInventoryKardex({ dryRun: false });
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimientos");
    revalidatePath("/reportes");

    if (!result.success) {
      return {
        success: false,
        message: `Se reconciliaron ${result.reconciled} registros, pero hubo observaciones en ${result.skipped}.`,
        reconciled: result.reconciled,
        skipped: result.skipped,
        errors: result.errors,
      };
    }

    return {
      success: true,
      message: `¡Kardex reconciliado exitosamente! ${result.reconciled} registros alineados con el saldo físico.`,
      reconciled: result.reconciled,
      alreadyOk: result.alreadyOk,
    };
  } catch (error) {
    const pubErr = publicError(error, "Error al reconciliar el Kardex histórico.");
    return {
      success: false,
      message: pubErr.message,
      code: pubErr.code,
    };
  }
}
