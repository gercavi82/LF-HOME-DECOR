import "server-only";

import { z } from "zod";
import { execute, queryOne } from "@/src/lib/db/mysql";
import { hashPassword } from "@/src/lib/auth/password";
import {
  requirePermission,
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

export async function createInternalUser(input: CreateInternalUserInput) {
  await requirePermission("USUARIO_CREAR");

  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Datos de usuario inválidos.");
  }

  const user = parsed.data;

  // La contraseña inicial es la cédula del usuario, hasheada con bcrypt
  const initialPasswordHash = await hashPassword(user.cedula);

  try {
    const result = await execute(
      `INSERT INTO usuarios (
         cedula,
         correo,
         nombres,
         apellidos,
         id_perfil,
         id_local,
         telefono,
         password_hash,
         activo,
         bloqueado,
         debe_cambiar_password,
         intentos_fallidos,
         fecha_creacion
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, 0, NOW())`,
      [
        user.cedula,
        user.correo,
        user.nombres,
        user.apellidos,
        user.id_perfil,
        user.id_local,
        user.telefono ?? null,
        initialPasswordHash,
      ]
    );

    return {
      id_usuario: result.insertId,
      cedula: user.cedula,
      correo: user.correo,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "ER_DUP_ENTRY") {
      throw new Error("Ya existe un usuario con esa cédula o correo electrónico.");
    }
    console.error("MySQL createInternalUser ERROR:", error);
    throw new Error("No fue posible crear el usuario interno.");
  }
}

export async function resetInternalUserPassword(userId: number) {
  await requirePermission("USUARIO_EDITAR");

  const internalUser = await queryOne<{ id_usuario: number; cedula: string }>(
    `SELECT id_usuario, cedula FROM usuarios WHERE id_usuario = ? LIMIT 1`,
    [userId]
  );

  if (!internalUser) {
    throw new Error("No fue posible encontrar el usuario.");
  }

  // Restablecer contraseña a la cédula
  const resetPasswordHash = await hashPassword(internalUser.cedula);

  await execute(
    `UPDATE usuarios 
     SET password_hash = ?, 
         debe_cambiar_password = 1, 
         intentos_fallidos = 0, 
         bloqueado = 0, 
         fecha_actualizacion = NOW() 
     WHERE id_usuario = ?`,
    [resetPasswordHash, internalUser.id_usuario]
  );

  // Revocar sesiones activas del usuario para forzar re-inicio con la nueva clave temporal
  await execute(
    `UPDATE sesiones_usuario SET revocada = 1 WHERE id_usuario = ?`,
    [internalUser.id_usuario]
  );

  return {
    message: "La contraseña temporal fue restablecida a la cédula del usuario.",
  };
}
