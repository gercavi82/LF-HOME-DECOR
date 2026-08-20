import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";

const cedulaSchema = z.string().trim().regex(/^\d{10}$/, "Cédula inválida");

export type ResolvedUser = {
  id_usuario: number;
  auth_user_id: string | null;
  cedula: string;
  correo: string;
  nombres: string;
  apellidos: string;
  id_perfil: number;
  activo: boolean;
  bloqueado: boolean;
  debe_cambiar_password: boolean;
  intentos_fallidos: number;
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
      "id_usuario, auth_user_id, cedula, correo, nombres, apellidos, id_perfil, activo, bloqueado, debe_cambiar_password, intentos_fallidos",
    )
    .eq("cedula", parsedCedula.data)
    .maybeSingle();

  if (error) {
    throw new Error("No fue posible consultar el usuario interno.");
  }

  return data;
}