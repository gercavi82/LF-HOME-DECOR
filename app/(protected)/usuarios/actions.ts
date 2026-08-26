"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { execute } from "@/src/lib/db/mysql";
import { createUserFormSchema, updateUserFormSchema, userFieldErrors, type UserFormField } from "@/src/lib/validation/users";
import { requirePermission } from "@/src/services/auth/authorization";
import { recordAuditEvent } from "@/src/services/audit/audit";
import {
  createInternalUser,
  resetInternalUserPassword,
} from "@/src/services/users/admin-user-auth";
import { getUserById } from "@/src/services/users/users";

export type UserActionState = { error?: string; fieldErrors?: Partial<Record<UserFormField, string>> };

const statusSchema = z.object({
  id_usuario: z.coerce.number().int().positive(),
  operation: z.enum(["activate", "deactivate", "block", "unblock"]),
});

export async function createUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await requirePermission("USUARIO_CREAR");
  const parsed = createUserFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Revise los campos marcados.", fieldErrors: userFieldErrors(parsed.error) };
  }

  let createdUserId: number;
  try {
    const result = await createInternalUser({
      ...parsed.data,
      telefono: parsed.data.telefono || null,
    });
    createdUserId = result.id_usuario;
    await recordAuditEvent({
      userId: context.id_usuario,
      table: "usuarios",
      action: "INSERT",
      recordId: result.id_usuario,
      newValue: { id_usuario: result.id_usuario, creado_por_administrador: true },
    });
  } catch (error) {
    console.error("createUserAction ERROR:", error);
    return { error: "No fue posible crear el usuario. Verifique que la cédula y el correo no estén registrados." };
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios/${createdUserId}?created=1`);
}

export async function updateUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await requirePermission("USUARIO_EDITAR");
  const parsed = updateUserFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Revise los campos marcados.", fieldErrors: userFieldErrors(parsed.error) };
  }

  const target = await getUserById(parsed.data.id_usuario);
  if (!target) return { error: "Usuario no encontrado." };

  if (target.id_usuario === context.id_usuario && target.id_perfil !== parsed.data.id_perfil) {
    return { error: "No puede cambiar su propio perfil." };
  }

  try {
    await execute(
      `UPDATE usuarios 
       SET nombres = ?, 
           apellidos = ?, 
           telefono = ?, 
           id_perfil = ?, 
           id_local = ?, 
           fecha_actualizacion = NOW() 
       WHERE id_usuario = ?`,
      [
        parsed.data.nombres,
        parsed.data.apellidos,
        parsed.data.telefono || null,
        parsed.data.id_perfil,
        parsed.data.id_local,
        parsed.data.id_usuario,
      ]
    );

    await recordAuditEvent({
      userId: context.id_usuario,
      table: "usuarios",
      action: "UPDATE",
      recordId: target.id_usuario,
      previousValue: {
        nombres: target.nombres,
        apellidos: target.apellidos,
        telefono: target.telefono,
        id_perfil: target.id_perfil,
        id_local: target.id_local,
      },
      newValue: {
        nombres: parsed.data.nombres,
        apellidos: parsed.data.apellidos,
        telefono: parsed.data.telefono || null,
        id_perfil: parsed.data.id_perfil,
        id_local: parsed.data.id_local,
      },
    });
  } catch (error) {
    console.error("updateUserAction ERROR:", error);
    return { error: "No fue posible actualizar el usuario." };
  }

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${parsed.data.id_usuario}`);
  redirect(`/usuarios/${parsed.data.id_usuario}?updated=1`);
}

export async function changeUserStatusAction(formData: FormData) {
  const context = await requirePermission("USUARIO_ESTADO");
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/usuarios?error=estado-invalido");

  const target = await getUserById(parsed.data.id_usuario);
  if (!target) redirect("/usuarios?error=usuario-no-encontrado");
  if (target.id_usuario === context.id_usuario) {
    redirect(`/usuarios/${target.id_usuario}?error=accion-propia`);
  }

  try {
    if (parsed.data.operation === "activate") {
      await execute(`UPDATE usuarios SET activo = 1, fecha_actualizacion = NOW() WHERE id_usuario = ?`, [target.id_usuario]);
    } else if (parsed.data.operation === "deactivate") {
      await execute(`UPDATE usuarios SET activo = 0, fecha_actualizacion = NOW() WHERE id_usuario = ?`, [target.id_usuario]);
      // Revocar sesiones activas al desactivar usuario
      await execute(`UPDATE sesiones_usuario SET revocada = 1 WHERE id_usuario = ?`, [target.id_usuario]);
    } else if (parsed.data.operation === "block") {
      await execute(`UPDATE usuarios SET bloqueado = 1, fecha_actualizacion = NOW() WHERE id_usuario = ?`, [target.id_usuario]);
      // Revocar sesiones activas al bloquear usuario
      await execute(`UPDATE sesiones_usuario SET revocada = 1 WHERE id_usuario = ?`, [target.id_usuario]);
    } else if (parsed.data.operation === "unblock") {
      await execute(`UPDATE usuarios SET bloqueado = 0, intentos_fallidos = 0, fecha_actualizacion = NOW() WHERE id_usuario = ?`, [target.id_usuario]);
    }

    await recordAuditEvent({
      userId: context.id_usuario,
      table: "usuarios",
      action: "UPDATE",
      recordId: target.id_usuario,
      previousValue: {
        activo: target.activo,
        bloqueado: target.bloqueado,
        intentos_fallidos: target.intentos_fallidos,
      },
      newValue: { operacion: parsed.data.operation },
    });
  } catch (error) {
    console.error("changeUserStatusAction ERROR:", error);
    redirect(`/usuarios/${target.id_usuario}?error=estado-no-actualizado`);
  }

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${target.id_usuario}`);
  redirect(`/usuarios/${target.id_usuario}?status=updated`);
}

export async function resetUserPasswordAction(formData: FormData) {
  const context = await requirePermission("USUARIO_ESTADO");
  const internalUserId = z.coerce.number().int().positive().safeParse(formData.get("id_usuario"));
  if (!internalUserId.success) redirect("/usuarios?error=usuario-invalido");

  try {
    await resetInternalUserPassword(internalUserId.data);
    await recordAuditEvent({
      userId: context.id_usuario,
      table: "auth",
      action: "CAMBIO_PASSWORD",
      recordId: internalUserId.data,
      newValue: { tipo: "RESTABLECIMIENTO_ADMINISTRATIVO", resultado: "EXITOSO" },
    });
  } catch (error) {
    console.error("resetUserPasswordAction ERROR:", error);
    redirect(`/usuarios/${internalUserId.data}?error=reset-no-completado`);
  }

  revalidatePath(`/usuarios/${internalUserId.data}`);
  redirect(`/usuarios/${internalUserId.data}?reset=1`);
}
