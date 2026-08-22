"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/src/lib/supabase/server";
import { resolveUserByCedula } from "@/src/services/auth/resolve-user-by-cedula";

const recoverySchema = z.object({
  cedula: z.string().trim().regex(/^\d{10}$/),
});

export type RecoveryState = {
  error?: string;
  success?: string;
};

const genericSuccess =
  "Si la cuenta existe, recibirá un correo con instrucciones para restablecer su contraseña.";

async function getApplicationOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredSiteUrl) {
    const configuredUrl = new URL(configuredSiteUrl);
    if (configuredUrl.protocol === "https:" || configuredUrl.hostname === "localhost") {
      return configuredUrl.origin;
    }
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) return null;

  const requestOrigin = new URL(origin);
  return requestOrigin.protocol === "https:" || requestOrigin.hostname === "localhost"
    ? requestOrigin.origin
    : null;
}

export async function requestPasswordRecovery(
  _previousState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = recoverySchema.safeParse({
    cedula: formData.get("cedula"),
  });

  if (!parsed.success) {
    return { error: "Ingrese una cédula válida de 10 dígitos." };
  }

  try {
    const user = await resolveUserByCedula(parsed.data.cedula);

    if (!user || !user.activo || user.bloqueado) {
      return { success: genericSuccess };
    }

    const origin = await getApplicationOrigin();

    if (!origin) {
      return { error: "No fue posible iniciar la recuperación." };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.correo, {
      redirectTo: `${origin}/auth/confirm?next=/cambiar-password`,
    });

    if (error) {
      console.error("SUPABASE password recovery ERROR:", {
        code: error.code,
        message: error.message,
      });
    }

    return { success: genericSuccess };
  } catch (error) {
    console.error("Password recovery server ERROR:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return { success: genericSuccess };
  }
}
