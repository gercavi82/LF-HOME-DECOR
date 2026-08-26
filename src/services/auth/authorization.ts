import "server-only";

import { redirect } from "next/navigation";
import { query, queryOne } from "@/src/lib/db/mysql";
import { validateCurrentSession, type UserSession } from "@/src/lib/auth/session";

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
  id_perfil: number;
  id_local: number | null;
  perfil: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  debe_cambiar_password: boolean;
  permisos: Permission[];
};

/**
 * Obtiene la sesión activa actual desde la cookie HttpOnly y la base de datos MySQL.
 * Retorna null si no existe una sesión válida, está expirada o revocada.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  return validateCurrentSession();
}

/**
 * Obtiene los permisos asignados a un perfil específico desde la tabla perfil_permisos.
 */
export async function getUserPermissions(profileId: number): Promise<Permission[]> {
  try {
    const rows = await query<Permission>(
      `SELECT 
         perm.id_permiso,
         perm.codigo,
         perm.nombre
       FROM perfil_permisos pp
       JOIN permisos perm ON perm.id_permiso = pp.id_permiso
       WHERE pp.id_perfil = ? AND perm.activo = 1`,
      [profileId]
    );

    return rows || [];
  } catch (error) {
    console.error("Error al obtener permisos de perfil:", error);
    return [];
  }
}

/**
 * Obtiene el contexto del usuario autenticado actual con sus permisos dinámicos.
 * Retorna null si no está autenticado.
 */
export async function getCurrentUser(): Promise<AuthContext | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  // Obtener perfil del usuario
  const profile = await queryOne<{ nombre: string }>(
    `SELECT nombre FROM perfiles WHERE id_perfil = ? AND activo = 1 LIMIT 1`,
    [session.id_perfil]
  );

  if (!profile) {
    return null;
  }

  // Obtener permisos asignados al perfil a través de perfil_permisos
  const permisos = await getUserPermissions(session.id_perfil);

  return {
    id_usuario: session.id_usuario,
    id_perfil: session.id_perfil,
    id_local: session.id_local,
    perfil: profile.nombre,
    cedula: session.cedula,
    nombres: session.nombres,
    apellidos: session.apellidos,
    debe_cambiar_password: Boolean(session.debe_cambiar_password),
    permisos,
  };
}

/**
 * Alias para compatibilidad de servicios existentes.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  return getCurrentUser();
}

/**
 * Verifica si el usuario actual posee un permiso específico (basado en perfil_permisos).
 */
export async function hasPermission(permissionCode: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return user.permisos.some((p) => p.codigo === permissionCode);
}

/**
 * Exige que el usuario esté autenticado.
 * Si no hay sesión válida, redirige a /login.
 * Si debe cambiar contraseña, redirige a /cambiar-password.
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getCurrentUser();

  if (!context) {
    redirect("/login");
  }

  if (context.debe_cambiar_password) {
    redirect("/cambiar-password");
  }

  return context;
}

/**
 * Alias para compatibilidad de servicios existentes.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  return requireAuth();
}

/**
 * Exige que el usuario tenga un permiso específico asignado.
 * No hardcodea nombres de perfil; valida estrictamente contra perfil_permisos.
 * Si no tiene el permiso, redirige a /sin-permiso.
 */
export async function requirePermission(permissionCode: string): Promise<AuthContext> {
  const context = await requireAuth();

  const isAllowed = context.permisos.some(
    (permission) => permission.codigo === permissionCode
  );

  if (!isAllowed) {
    redirect("/sin-permiso");
  }

  return context;
}
