"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";

import { execute, queryOne } from "@/src/lib/db/mysql";
import { verifyPassword } from "@/src/lib/auth/password";
import { createSession, revokeCurrentSession, validateCurrentSession } from "@/src/lib/auth/session";
import { recordAuditEvent } from "@/src/services/audit/audit";
import { resolveUserByCedula } from "@/src/services/auth/resolve-user-by-cedula";

const loginSchema = z.object({
  cedula: z.string().trim().regex(/^\d{10}$/, "Cédula inválida"),
  password: z.string().min(1, "Contraseña obligatoria"),
});

export type LoginState = {
  error?: string;
};

const genericLoginError = "Usuario o contraseña incorrectos.";
const unavailableLoginError = "No fue posible iniciar sesión. Intente nuevamente en unos momentos.";
const rateLimitError = "Demasiados intentos. Espere 15 minutos antes de volver a intentar.";
const accountBlockedError = "Su cuenta ha sido bloqueada por exceso de intentos fallidos. Contacte al administrador.";

async function loginRateKey(cedula: string): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "local";
  const salt = process.env.SESSION_SECRET || "lf-decor-auth-salt";
  return createHash("sha256").update(`${cedula}:${address}:${salt}`).digest("hex");
}

async function controlLoginRate(key: string, operation: "CHECK" | "FAILURE" | "SUCCESS"): Promise<boolean> {
  try {
    if (operation === "SUCCESS") {
      await execute(`DELETE FROM auth_rate_limits WHERE clave_hash = ?`, [key]);
      return true;
    }

    const row = await queryOne<{ intentos: number; ventana_inicio: Date; bloqueado_hasta: Date | null }>(
      `SELECT intentos, ventana_inicio, bloqueado_hasta FROM auth_rate_limits WHERE clave_hash = ? LIMIT 1`,
      [key]
    );

    const now = new Date();

    if (row?.bloqueado_hasta && new Date(row.bloqueado_hasta) > now) {
      return false;
    }

    if (operation === "CHECK") {
      return true;
    }

    if (operation === "FAILURE") {
      const isWindowExpired = !row || (now.getTime() - new Date(row.ventana_inicio).getTime()) > 15 * 60 * 1000;
      const nextAttempts = isWindowExpired ? 1 : (row.intentos + 1);
      const isBlocked = nextAttempts >= 10;
      const blockUntil = isBlocked ? new Date(now.getTime() + 15 * 60 * 1000) : null;

      await execute(
        `INSERT INTO auth_rate_limits (clave_hash, intentos, ventana_inicio, bloqueado_hasta, actualizado_en)
         VALUES (?, ?, NOW(), ?, NOW())
         ON DUPLICATE KEY UPDATE
           intentos = VALUES(intentos),
           bloqueado_hasta = VALUES(bloqueado_hasta),
           actualizado_en = NOW()`,
        [key, nextAttempts, blockUntil]
      );
    }

    return true;
  } catch (err) {
    console.error("Rate limit check error:", err);
    return true;
  }
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    cedula: formData.get("cedula"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: genericLoginError };
  }

  const rateKey = await loginRateKey(parsed.data.cedula);
  const isRateAllowed = await controlLoginRate(rateKey, "CHECK");
  if (!isRateAllowed) {
    return { error: rateLimitError };
  }

  let user: Awaited<ReturnType<typeof resolveUserByCedula>>;
  try {
    user = await resolveUserByCedula(parsed.data.cedula);
  } catch (error) {
    console.error("Login user lookup ERROR:", error);
    return { error: unavailableLoginError };
  }

  if (!user || !user.activo) {
    await controlLoginRate(rateKey, "FAILURE");
    return { error: genericLoginError };
  }

  if (user.bloqueado) {
    return { error: accountBlockedError };
  }

  const isValidPassword = await verifyPassword(parsed.data.password, user.password_hash);

  if (!isValidPassword) {
    const nextFailedAttempts = (user.intentos_fallidos || 0) + 1;
    const shouldBlock = nextFailedAttempts >= 5;

    await execute(
      `UPDATE usuarios 
       SET intentos_fallidos = ?, bloqueado = ?
       WHERE id_usuario = ?`,
      [nextFailedAttempts, shouldBlock ? 1 : 0, user.id_usuario]
    );

    await recordAuditEvent({
      userId: user.id_usuario,
      table: "auth",
      action: "LOGIN",
      recordId: user.id_usuario,
      previousValue: { intentos_fallidos: user.intentos_fallidos },
      newValue: {
        resultado: "FALLIDO",
        intentos_fallidos: nextFailedAttempts,
        bloqueado: shouldBlock,
      },
    });

    await controlLoginRate(rateKey, "FAILURE");

    if (shouldBlock) {
      return { error: accountBlockedError };
    }

    return { error: genericLoginError };
  }

  // Contraseña correcta: actualizar acceso y resetear intentos
  await execute(
    `UPDATE usuarios 
     SET ultimo_acceso = NOW(), intentos_fallidos = 0 
     WHERE id_usuario = ?`,
    [user.id_usuario]
  );

  // Crear sesión en MySQL y asignar cookie HttpOnly
  await createSession(user.id_usuario);

  await recordAuditEvent({
    userId: user.id_usuario,
    table: "auth",
    action: "LOGIN",
    recordId: user.id_usuario,
    newValue: { resultado: "EXITOSO" },
  });

  await controlLoginRate(rateKey, "SUCCESS");

  redirect(user.debe_cambiar_password ? "/cambiar-password" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await validateCurrentSession();

  if (session) {
    await recordAuditEvent({
      userId: session.id_usuario,
      table: "auth",
      action: "LOGOUT",
      recordId: session.id_usuario,
      newValue: { resultado: "EXITOSO" },
    });
  }

  await revokeCurrentSession();
  redirect("/login");
}
