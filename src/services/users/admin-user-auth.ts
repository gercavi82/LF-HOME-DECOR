import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import {
  requireAuthContext,
  ROLE_NAMES,
} from "@/src/services/auth/authorization";

const cedulaSchema = z.string().trim().regex(/^\d{10}$/);
const emailSchema = z.string().trim().email();

const createUserSchema = z.object({
  cedula: cedulaSchema,
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
  correo: emailSchema,
  id_perfil: z.number().int().positive(),
  id_local: z.number().int().positive(),
  telefono: z.string().trim().min(1).nullable().optional(),
});

export type CreateInternalUserInput = z.infer<typeof createUserSchema>;

async function requireAdministrator() {
  const context = await requireAuthContext();

  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR) {
    throw new Error("No autorizado.");
  }
}

export async function createInternalUser(input: CreateInternalUserInput) {
  await requireAdministrator();

  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Datos de usuario inválidos.");
  }

  const admin = createAdminClient();
  const user = parsed.data;
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: user.correo,
      password: user.cedula,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    throw new Error("No fue posible crear la cuenta de acceso.");
  }

  const { data: internalUser, error: internalUserError } = await admin
    .from("usuarios")
    .insert({
      auth_user_id: authData.user.id,
      cedula: user.cedula,
      correo: user.correo,
      nombres: user.nombres,
      apellidos: user.apellidos,
      id_perfil: user.id_perfil,
      id_local: user.id_local,
      telefono: user.telefono ?? null,
      activo: true,
      bloqueado: false,
      debe_cambiar_password: true,
      intentos_fallidos: 0,
    })
    .select("id_usuario, auth_user_id")
    .single();

  if (internalUserError) {
    const { error: rollbackError } =
      await admin.auth.admin.deleteUser(authData.user.id);

    if (rollbackError) {
      console.error("SUPABASE createInternalUser rollback ERROR:", {
        code: rollbackError.code,
        message: rollbackError.message,
      });
    }

    throw new Error("No fue posible crear el usuario interno.");
  }

  return internalUser;
}

export async function resetInternalUserPassword(authUserId: string) {
  await requireAdministrator();

  const parsedAuthUserId = z.string().uuid().safeParse(authUserId);

  if (!parsedAuthUserId.success) {
    throw new Error("Usuario inválido.");
  }

  const admin = createAdminClient();
  const { data: internalUser, error: lookupError } = await admin
    .from("usuarios")
    .select("id_usuario, cedula")
    .eq("auth_user_id", parsedAuthUserId.data)
    .maybeSingle();

  if (lookupError || !internalUser) {
    throw new Error("No fue posible encontrar el usuario.");
  }

  const { error: authError } = await admin.auth.admin.updateUserById(
    parsedAuthUserId.data,
    { password: internalUser.cedula },
  );

  if (authError) {
    throw new Error("No fue posible restablecer la contraseña temporal.");
  }

  const { error: updateError } = await admin
    .from("usuarios")
    .update({
      debe_cambiar_password: true,
      intentos_fallidos: 0,
      bloqueado: false,
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("id_usuario", internalUser.id_usuario);

  if (updateError) {
    throw new Error("La contraseña cambió, pero no fue posible actualizar su estado.");
  }

  return {
    message: "La contraseña temporal fue restablecida a la cédula del usuario.",
  };
}
