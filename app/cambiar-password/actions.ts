"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { execute } from "@/src/lib/db/mysql";
import { hashPassword } from "@/src/lib/auth/password";
import { validateCurrentSession } from "@/src/lib/auth/session";
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

  const session = await validateCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (parsed.data.password === session.cedula) {
    return { error: "La nueva contraseña no puede ser igual a la cédula." };
  }

  try {
    const newPasswordHash = await hashPassword(parsed.data.password);

    await execute(
      `UPDATE usuarios 
       SET password_hash = ?, 
           debe_cambiar_password = 0, 
           fecha_actualizacion = NOW() 
       WHERE id_usuario = ?`,
      [newPasswordHash, session.id_usuario]
    );

    await recordAuditEvent({
      userId: session.id_usuario,
      table: "auth",
      action: "CAMBIO_PASSWORD",
      recordId: session.id_usuario,
      newValue: { tipo: "CAMBIO_OBLIGATORIO", resultado: "EXITOSO" },
    });
  } catch (error) {
    console.error("Change password ERROR:", error);
    return { error: "No fue posible actualizar la contraseña." };
  }

  redirect("/dashboard");
}
