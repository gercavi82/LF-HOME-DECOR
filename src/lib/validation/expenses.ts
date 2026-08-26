import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "FIJO",
  "VARIABLE",
  "MARKETING",
  "OPERATIVO",
  "MEJORAS",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

export const createExpenseSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  categoria: expenseCategorySchema,
  descripcion: z.string().trim().min(2, "Descripción obligatoria").max(255),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  beneficiario: z.string().trim().max(150).optional(),
  observaciones: z.string().trim().max(500).optional(),
});

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseOutput = z.output<typeof createExpenseSchema>;
