import { z } from "zod";

const personName = z.string().trim().min(2, "Ingrese al menos 2 caracteres.").max(100, "Use máximo 100 caracteres.").regex(/^[\p{L}\p{M}' -]+$/u, "Use únicamente letras, espacios, apóstrofes o guiones.");

export const createUserFormSchema = z.object({
  cedula: z.string().trim().regex(/^\d{10}$/, "La cédula debe tener exactamente 10 dígitos."),
  nombres: personName,
  apellidos: personName,
  correo: z.string().trim().toLowerCase().email("Ingrese un correo electrónico válido.").max(254),
  telefono: z.string().trim().max(20, "Use máximo 20 caracteres.").regex(/^$|^[+\d][\d ()-]{6,19}$/, "Ingrese un teléfono válido."),
  id_perfil: z.coerce.number().int().positive("Seleccione un perfil."),
  id_local: z.coerce.number().int().positive("Seleccione un local."),
});

export const updateUserFormSchema = createUserFormSchema.extend({
  id_usuario: z.coerce.number().int().positive("Usuario inválido."),
});
export type CreateUserFormInput = z.input<typeof createUserFormSchema>;
export type UserFormField = keyof CreateUserFormInput;

export function userFieldErrors(error: z.ZodError) {
  const result: Partial<Record<UserFormField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in createUserFormSchema.shape && !result[field as UserFormField]) result[field as UserFormField] = issue.message;
  }
  return result;
}
