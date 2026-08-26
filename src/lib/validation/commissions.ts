import { z } from "zod";

export const commissionPaymentSchema = z.object({
  id_usuario: z.coerce.number().int().positive("Seleccione un asesor"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  forma_pago: z.string().trim().min(1, "Seleccione una forma de pago").default("Transferencia"),
  referencia: z.string().trim().max(100).optional(),
  observaciones: z.string().trim().max(500).optional(),
});

export type CommissionPaymentInput = z.infer<typeof commissionPaymentSchema>;
export type CommissionPaymentRawInput = z.input<typeof commissionPaymentSchema>;
