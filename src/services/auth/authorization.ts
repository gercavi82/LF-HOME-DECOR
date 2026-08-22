import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

export const ROLE_NAMES = {
  ADMINISTRADOR: "Administrador",
  VENTA_LOCAL: "Venta Local",
  ASESOR: "Asesor",
} as const;

export type Permission = {
  id_permiso: number;
  codigo: string;
  nombre: string;
};

export type AuthContext = {
  id_usuario: number;
  auth_user_id: string;
  id_perfil: number;
  id_local: number | null;
  perfil: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  debe_cambiar_password: boolean;
  permisos: Permission[];
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: user, error: userError } = await admin
    .from("usuarios")
    .select(
      "id_usuario, auth_user_id, id_perfil, id_local, cedula, nombres, apellidos, debe_cambiar_password, activo, bloqueado",
    )
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (
    userError ||
    !user ||
    user.auth_user_id !== authData.user.id ||
    !user.activo ||
    user.bloqueado
  ) {
    if (userError) {
      console.error("SUPABASE authorization user ERROR:", {
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
      });
    }

    await supabase.auth.signOut();
    return null;
  }

  const { data: profile, error: profileError } = await admin
    .from("perfiles")
    .select("id_perfil, nombre")
    .eq("id_perfil", user.id_perfil)
    .maybeSingle();

  if (profileError || !profile) {
    if (profileError) {
      console.error("SUPABASE authorization profile ERROR:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
    }

    return null;
  }

  const { data: profilePermissions, error: permissionsError } = await admin
    .from("perfil_permisos")
    .select("permisos ( id_permiso, codigo, nombre )")
    .eq("id_perfil", user.id_perfil);

  if (permissionsError) {
    console.error("SUPABASE authorization permissions ERROR:", {
      code: permissionsError.code,
      message: permissionsError.message,
      details: permissionsError.details,
      hint: permissionsError.hint,
    });

    return null;
  }

  const permisos = profilePermissions.flatMap((item) => {
    const permission = item.permisos;
    return Array.isArray(permission) ? permission : permission ? [permission] : [];
  }) as Permission[];

  return {
    id_usuario: user.id_usuario,
    auth_user_id: user.auth_user_id,
    id_perfil: user.id_perfil,
    id_local: user.id_local,
    perfil: profile.nombre,
    cedula: user.cedula,
    nombres: user.nombres,
    apellidos: user.apellidos,
    debe_cambiar_password: user.debe_cambiar_password,
    permisos,
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  if (context.debe_cambiar_password) {
    redirect("/cambiar-password");
  }

  return context;
}

export async function requirePermission(permissionCode: string) {
  const context = await requireAuthContext();

  if (
    context.perfil !== ROLE_NAMES.ADMINISTRADOR &&
    !context.permisos.some((permission) => permission.codigo === permissionCode)
  ) {
    redirect("/sin-permiso");
  }

  return context;
}
