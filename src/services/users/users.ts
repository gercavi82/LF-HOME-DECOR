import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { requirePermission } from "@/src/services/auth/authorization";

const userIdSchema = z.coerce.number().int().positive();

export type UserListItem = {
  id_usuario: number;
  auth_user_id: string | null;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  id_perfil: number;
  id_local: number | null;
  perfil: string;
  local: string;
  activo: boolean;
  bloqueado: boolean;
  debe_cambiar_password: boolean;
  intentos_fallidos: number;
  ultimo_acceso: string | null;
};

export type UserCatalogs = {
  profiles: Array<{ id_perfil: number; nombre: string }>;
  locations: Array<{ id_local: number; nombre: string }>;
};

function normalizeSearch(search: string) {
  return search
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}@._\-\s]/gu, "")
    .trim()
    .slice(0, 80);
}

export async function getUserCatalogs(): Promise<UserCatalogs> {
  const admin = createAdminClient();
  const [profilesResult, locationsResult] = await Promise.all([
    admin.from("perfiles").select("id_perfil, nombre").eq("activo", true).order("nombre"),
    admin.from("locales").select("id_local, nombre").eq("activo", true).order("nombre"),
  ]);

  if (profilesResult.error || locationsResult.error) {
    console.error("SUPABASE user catalogs ERROR:", {
      profiles: profilesResult.error?.message,
      locations: locationsResult.error?.message,
    });
    throw new Error("No fue posible cargar perfiles y locales.");
  }

  return {
    profiles: profilesResult.data,
    locations: locationsResult.data,
  };
}

export async function listUsers(search = "") {
  await requirePermission("USUARIO_VER");
  const admin = createAdminClient();
  const normalizedSearch = normalizeSearch(search);
  let query = admin
    .from("usuarios")
    .select("id_usuario, auth_user_id, cedula, nombres, apellidos, correo, telefono, id_perfil, id_local, activo, bloqueado, debe_cambiar_password, intentos_fallidos, ultimo_acceso", { count: "exact" })
    .order("nombres")
    .order("apellidos")
    .limit(50);

  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    query = query.or(`cedula.ilike.${pattern},nombres.ilike.${pattern},apellidos.ilike.${pattern},correo.ilike.${pattern}`);
  }

  const [{ data: users, error, count }, catalogs] = await Promise.all([
    query,
    getUserCatalogs(),
  ]);

  if (error) {
    console.error("SUPABASE listUsers ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("No fue posible cargar los usuarios.");
  }

  const profileNames = new Map(catalogs.profiles.map((profile) => [profile.id_perfil, profile.nombre]));
  const locationNames = new Map(catalogs.locations.map((location) => [location.id_local, location.nombre]));
  const mappedUsers: UserListItem[] = users.map((user) => ({
    ...user,
    perfil: profileNames.get(user.id_perfil) ?? "Sin perfil",
    local: user.id_local ? locationNames.get(user.id_local) ?? "Sin local" : "Sin local",
  }));

  return { users: mappedUsers, count: count ?? mappedUsers.length };
}

export async function getUserById(id: number | string) {
  await requirePermission("USUARIO_VER");
  const parsedId = userIdSchema.safeParse(id);
  if (!parsedId.success) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("id_usuario, auth_user_id, cedula, nombres, apellidos, correo, telefono, id_perfil, id_local, activo, bloqueado, debe_cambiar_password, intentos_fallidos, ultimo_acceso")
    .eq("id_usuario", parsedId.data)
    .maybeSingle();

  if (error) {
    console.error("SUPABASE getUserById ERROR:", { code: error.code, message: error.message });
    throw new Error("No fue posible cargar el usuario.");
  }

  return data;
}
