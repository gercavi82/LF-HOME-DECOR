"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { recordAuditEvent } from "@/src/services/audit/audit";

const passwordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmation: z.string().min(1, "Confirme la nueva contraseña."),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export type ChangePasswordState = { error?: string };

export async function changePasswordAction(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: internalUser, error: internalUserError } = await admin
    .from("usuarios")
    .select("id_usuario, cedula")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (internalUserError || !internalUser) {
    if (internalUserError) {
      console.error("SUPABASE changePassword user ERROR:", {
        code: internalUserError.code,
        message: internalUserError.message,
        details: internalUserError.details,
        hint: internalUserError.hint,
      });
    }
    return { error: "No fue posible validar el usuario." };
  }

  if (parsed.data.password === internalUser.cedula) {
    return { error: "La nueva contraseña no puede ser igual a la cédula." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    console.error("SUPABASE changePassword auth ERROR:", {
      code: updateError.code,
      message: updateError.message,
    });
    return { error: "No fue posible actualizar la contraseña." };
  }

  const { error: statusUpdateError } = await admin
    .from("usuarios")
    .update({
      debe_cambiar_password: false,
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("auth_user_id", data.user.id);

  if (statusUpdateError) {
    console.error("SUPABASE changePassword status ERROR:", {
      code: statusUpdateError.code,
      message: statusUpdateError.message,
      details: statusUpdateError.details,
      hint: statusUpdateError.hint,
    });

    return { error: "La contraseña cambió, pero no fue posible actualizar su estado." };
  }

  await recordAuditEvent({
    userId: internalUser.id_usuario,
    table: "auth",
    action: "CAMBIO_PASSWORD",
    recordId: internalUser.id_usuario,
    newValue: { tipo: "CAMBIO_OBLIGATORIO", resultado: "EXITOSO" },
  });

  redirect("/dashboard");
}
