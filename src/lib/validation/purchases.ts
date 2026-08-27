import { z } from "zod";

export const purchasePaymentSchema = z.object({
  id_compra: z.coerce.number().int().positive("Seleccione una compra"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  forma_pago: z.string().trim().min(1, "Seleccione una forma de pago").default("Transferencia"),
  referencia: z.string().trim().max(100).optional(),
  observaciones: z.string().trim().max(500).optional(),
});

export type PurchasePaymentInput = z.infer<typeof purchasePaymentSchema>;

export const purchaseItemSchema = z.object({
  id_variante: z.coerce.number().int().positive("Seleccione un producto"),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.coerce.number().positive("El precio debe ser mayor a 0"),
  porcentaje_iva: z.coerce.number().min(0).max(100).default(15),
});

export const purchaseCreateSchema = z.object({
  id_proveedor: z.coerce.number().int().positive("Seleccione un proveedor"),
  numero_compra: z.string().trim().min(1, "Ingrese el número de compra/factura"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  observaciones: z.string().trim().max(500).optional(),
  items: z.array(purchaseItemSchema).min(1, "Debe agregar al menos un producto a la compra"),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;

export type PurchasesFilterParams = {
  year?: string;
  month?: string;
  tipoId?: string;
  q?: string;
};
