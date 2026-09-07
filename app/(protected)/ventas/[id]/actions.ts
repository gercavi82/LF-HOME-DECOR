"use server";

import { revalidatePath } from "next/cache";
import { annulSaleTransaction } from "@/src/services/sales/transactions";
import { publicError } from "@/src/lib/errors";

export async function annulSaleAction(
  saleId: number,
  motivo?: string
): Promise<{ success: boolean; error?: string; numero_venta?: string }> {
  try {
    const result = await annulSaleTransaction(saleId, motivo);

    revalidatePath("/ventas");
    revalidatePath(`/ventas/${saleId}`);
    revalidatePath("/ventas/historial");
    revalidatePath("/dashboard");
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimientos");
    revalidatePath("/reportes");
    revalidatePath("/reportes/ventas");
    revalidatePath("/reportes/comisiones");

    return { success: true, numero_venta: result.numero_venta };
  } catch (error) {
    const result = publicError(error, "No fue posible anular la venta.");
    return { success: false, error: result.message };
  }
}
