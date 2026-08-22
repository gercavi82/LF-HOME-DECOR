import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";

const cedulaSchema = z.string().trim().regex(/^\d{10}$/, "Cédula inválida");

export type ResolvedUser = {
  id_usuario: number;
  auth_user_id: string | null;
  id_perfil: number;
  id_local: number | null;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  debe_cambiar_password: boolean;
  intentos_fallidos: number;
  activo: boolean;
  bloqueado: boolean;
  ultimo_acceso: string | null;
};

export async function resolveUserByCedula(
  cedula: string,
): Promise<ResolvedUser | null> {
  const parsedCedula = cedulaSchema.safeParse(cedula);

  if (!parsedCedula.success) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select(
      `
        id_usuario,
        auth_user_id,
        id_perfil,
        id_local,
        cedula,
        nombres,
        apellidos,
        correo,
        telefono,
        debe_cambiar_password,
        intentos_fallidos,
        bloqueado,
        activo,
        ultimo_acceso
      `,
    )
    .eq("cedula", parsedCedula.data)
    .maybeSingle();

  if (error) {
    console.error("SUPABASE resolveUserByCedula ERROR:", {
      code: (error as { code?: string }).code,
      message: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });

    throw new Error("No fue posible consultar el usuario interno.");
  }

  return data;
}
