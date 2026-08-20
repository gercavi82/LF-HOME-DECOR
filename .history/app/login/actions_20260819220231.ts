"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { resolveUserByCedula } from "@/src/services/auth/resolve-user-by-cedula";

const loginSchema = z.object({
  cedula: z.string().trim().regex(/^\d{10}$/, "Cédula inválida"),
  password: z.string().min(1, "Contraseña obligatoria"),
});

export type LoginState = {
  error?: string;
};

const genericLoginError = "Usuario o contraseña incorrectos.";

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

  const admin = createAdminClient();
  const user = await resolveUserByCedula(parsed.data.cedula);

  if (!user || !user.activo || user.bloqueado || !user.auth_user_id) {
    return { error: genericLoginError };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: user.correo,
      password: parsed.data.password,
    });

  if (authError || !authData.user) {
    const nextFailedAttempts = user.intentos_fallidos + 1;
    await admin
      .from("usuarios")
      .update({
        intentos_fallidos: nextFailedAttempts,
        bloqueado: nextFailedAttempts >= 5,
      })
      .eq("id_usuario", user.id_usuario);

    return { error: genericLoginError };
  }

  if (authData.user.id !== user.auth_user_id) {
    await supabase.auth.signOut();
    return { error: "No fue posible validar la cuenta. Contacte al administrador." };
  }

  await admin
    .from("usuarios")
    .update({
      ultimo_acceso: new Date().toISOString(),
      intentos_fallidos: 0,
    })
    .eq("id_usuario", user.id_usuario);

  redirect(user.debe_cambiar_password ? "/cambiar-password" : "/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}