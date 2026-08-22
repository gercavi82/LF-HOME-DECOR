"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
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
const unavailableLoginError =
  "No fue posible iniciar sesión. Intente nuevamente en unos momentos.";
const rateLimitError = "Demasiados intentos. Espere 15 minutos antes de volver a intentar.";

async function loginRateKey(cedula: string) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "local";
  return createHash("sha256").update(`${cedula}:${address}:${process.env.SUPABASE_SECRET_KEY ?? "server"}`).digest("hex");
}

async function controlLoginRate(admin: ReturnType<typeof createAdminClient>, key: string, operation: "CHECK" | "FAILURE" | "SUCCESS") {
  const { data, error } = await admin.rpc("sp_controlar_limite_login", { p_clave_hash: key, p_operacion: operation });
  if (error) {
    console.error("SUPABASE login rate limit ERROR:", { code: error.code, operation });
    return true;
  }
  return (data as { permitido?: boolean } | null)?.permitido !== false;
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

  let admin: ReturnType<typeof createAdminClient>;
  let user: Awaited<ReturnType<typeof resolveUserByCedula>>;

  try {
    admin = createAdminClient();
    const rateKey = await loginRateKey(parsed.data.cedula);
    if (!await controlLoginRate(admin, rateKey, "CHECK")) return { error: rateLimitError };
    user = await resolveUserByCedula(parsed.data.cedula);
  } catch (error) {
    console.error("Login internal user lookup ERROR:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: unavailableLoginError };
  }

  if (!user || !user.activo || user.bloqueado || !user.auth_user_id) {
    await controlLoginRate(admin, await loginRateKey(parsed.data.cedula), "FAILURE");
    return { error: genericLoginError };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: user.correo,
      password: parsed.data.password,
    });

  if (authError || !authData.user) {
    console.error("SUPABASE signInWithPassword ERROR:", {
      code: (authError as { code?: string } | null)?.code,
      message: authError?.message,
      details: (authError as { details?: string } | null)?.details,
      hint: (authError as { hint?: string } | null)?.hint,
    });

    const nextFailedAttempts = user.intentos_fallidos + 1;
    const { error: attemptsError } = await admin
      .from("usuarios")
      .update({
        intentos_fallidos: nextFailedAttempts,
        bloqueado: nextFailedAttempts >= 5,
      })
      .eq("id_usuario", user.id_usuario);

    if (attemptsError) {
      console.error("SUPABASE login attempts ERROR:", {
        code: attemptsError.code,
        message: attemptsError.message,
        details: attemptsError.details,
        hint: attemptsError.hint,
      });
    }

    await recordAuditEvent({
      userId: user.id_usuario,
      table: "auth",
      action: "LOGIN",
      recordId: user.id_usuario,
      previousValue: { intentos_fallidos: user.intentos_fallidos },
      newValue: {
        resultado: "FALLIDO",
        intentos_fallidos: nextFailedAttempts,
        bloqueado: nextFailedAttempts >= 5,
      },
    });

    await controlLoginRate(admin, await loginRateKey(parsed.data.cedula), "FAILURE");

    return { error: genericLoginError };
  }

  if (authData.user.id !== user.auth_user_id) {
    await supabase.auth.signOut();
    return { error: genericLoginError };
  }

  const { error: accessUpdateError } = await admin
    .from("usuarios")
    .update({
      ultimo_acceso: new Date().toISOString(),
      intentos_fallidos: 0,
    })
    .eq("id_usuario", user.id_usuario);

  if (accessUpdateError) {
    console.error("SUPABASE login access update ERROR:", {
      code: accessUpdateError.code,
      message: accessUpdateError.message,
      details: accessUpdateError.details,
      hint: accessUpdateError.hint,
    });
    await supabase.auth.signOut();
    return { error: unavailableLoginError };
  }

  await recordAuditEvent({
    userId: user.id_usuario,
    table: "auth",
    action: "LOGIN",
    recordId: user.id_usuario,
    newValue: { resultado: "EXITOSO" },
  });

  await controlLoginRate(admin, await loginRateKey(parsed.data.cedula), "SUCCESS");

  redirect(user.debe_cambiar_password ? "/cambiar-password" : "/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const admin = createAdminClient();
    const { data: internalUser } = await admin
      .from("usuarios")
      .select("id_usuario")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (internalUser) {
      await recordAuditEvent({
        userId: internalUser.id_usuario,
        table: "auth",
        action: "LOGOUT",
        recordId: internalUser.id_usuario,
        newValue: { resultado: "EXITOSO" },
      });
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}
