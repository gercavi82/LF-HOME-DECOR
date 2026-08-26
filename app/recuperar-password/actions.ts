"use server";

import { z } from "zod";
import { resolveUserByCedula } from "@/src/services/auth/resolve-user-by-cedula";

const recoverySchema = z.object({
  cedula: z.string().trim().regex(/^\d{10}$/),
});

export type RecoveryState = {
  error?: string;
  success?: string;
};

const genericSuccess =
  "Si la cuenta existe, contacte al administrador del sistema para que restablezca su contraseña temporal a su número de cédula.";

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

    return { success: genericSuccess };
  } catch (error) {
    console.error("Password recovery server ERROR:", error);
    return { success: genericSuccess };
  }
}
