import "server-only";

import { z } from "zod";
import { query, queryOne } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

const userIdSchema = z.coerce.number().int().positive();

export type UserListItem = {
  id_usuario: number;
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
  const [profiles, locations] = await Promise.all([
    query<{ id_perfil: number; nombre: string }>(
      `SELECT id_perfil, nombre FROM perfiles WHERE activo = 1 ORDER BY nombre ASC`
    ),
    query<{ id_local: number; nombre: string }>(
      `SELECT id_local, nombre FROM locales WHERE activo = 1 ORDER BY nombre ASC`
    ),
  ]);

  return {
    profiles: profiles || [],
    locations: locations || [],
  };
}

export async function listUsers(search = "") {
  await requirePermission("USUARIO_VER");
  const normalizedSearch = normalizeSearch(search);

  let sql = `
    SELECT 
      u.id_usuario,
      u.cedula,
      u.nombres,
      u.apellidos,
      u.correo,
      u.telefono,
      u.id_perfil,
      u.id_local,
      COALESCE(p.nombre, 'Sin perfil') AS perfil,
      COALESCE(l.nombre, 'Sin local') AS local,
      u.activo,
      u.bloqueado,
      u.debe_cambiar_password,
      u.intentos_fallidos,
      u.ultimo_acceso
    FROM usuarios u
    LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil
    LEFT JOIN locales l ON l.id_local = u.id_local
  `;

  const params: unknown[] = [];

  if (normalizedSearch) {
    sql += `
      WHERE u.cedula LIKE ? 
         OR u.nombres LIKE ? 
         OR u.apellidos LIKE ? 
         OR u.correo LIKE ?
    `;
    const pattern = `%${normalizedSearch}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  sql += ` ORDER BY u.nombres ASC, u.apellidos ASC LIMIT 50`;

  const users = await query<UserListItem>(sql, params);

  return {
    users: users.map((u) => ({
      ...u,
      activo: Boolean(u.activo),
      bloqueado: Boolean(u.bloqueado),
      debe_cambiar_password: Boolean(u.debe_cambiar_password),
    })),
    count: users.length,
  };
}

export async function getUserById(id: number | string) {
  await requirePermission("USUARIO_VER");
  const parsedId = userIdSchema.safeParse(id);
  if (!parsedId.success) return null;

  const user = await queryOne<UserListItem>(
    `SELECT 
       u.id_usuario,
       u.cedula,
       u.nombres,
       u.apellidos,
       u.correo,
       u.telefono,
       u.id_perfil,
       u.id_local,
       COALESCE(p.nombre, 'Sin perfil') AS perfil,
       COALESCE(l.nombre, 'Sin local') AS local,
       u.activo,
       u.bloqueado,
       u.debe_cambiar_password,
       u.intentos_fallidos,
       u.ultimo_acceso
     FROM usuarios u
     LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil
     LEFT JOIN locales l ON l.id_local = u.id_local
     WHERE u.id_usuario = ?
     LIMIT 1`,
    [parsedId.data]
  );

  if (!user) return null;

  return {
    ...user,
    activo: Boolean(user.activo),
    bloqueado: Boolean(user.bloqueado),
    debe_cambiar_password: Boolean(user.debe_cambiar_password),
  };
}
