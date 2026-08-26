import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { queryOne, execute } from "@/src/lib/db/mysql";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "lf_session";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 días

export function getSessionMaxAge(): number {
  const configured = Number(process.env.SESSION_MAX_AGE);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

export type UserSession = {
  id_sesion: number;
  id_usuario: number;
  fecha_expiracion: Date;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  id_perfil: number;
  id_local: number | null;
  debe_cambiar_password: boolean;
  activo: boolean;
  bloqueado: boolean;
};

/** Genera un hash SHA-256 del token para almacenar en la base de datos */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Obtiene la IP del cliente desde los headers de la solicitud */
async function getClientIp(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || requestHeaders.get("x-real-ip") || "local";
  } catch {
    return null;
  }
}

/** Obtiene el User-Agent del cliente */
async function getClientUserAgent(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("user-agent")?.slice(0, 500) || null;
  } catch {
    return null;
  }
}

/**
 * Crea una sesión criptográficamente segura en MySQL y establece la cookie HttpOnly
 */
export async function createSession(userId: number): Promise<string> {
  // Generar token aleatorio de 32 bytes (64 caracteres hex)
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const maxAgeSeconds = getSessionMaxAge();
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  const ip = await getClientIp();
  const userAgent = await getClientUserAgent();

  // Guardar únicamente el HASH del token en la base de datos
  await execute(
    `INSERT INTO sesiones_usuario (id_usuario, token_hash, fecha_creacion, fecha_expiracion, ip, user_agent, revocada)
     VALUES (?, ?, NOW(), ?, ?, ?, 0)`,
    [userId, tokenHash, expiresAt, ip, userAgent]
  );

  // Establecer cookie HttpOnly con el token en claro
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: maxAgeSeconds,
  });

  return rawToken;
}

/**
 * Valida la sesión actual leyendo la cookie, calculando el hash y verificando en BD
 */
export async function validateCurrentSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const tokenHash = hashToken(sessionCookie.value);

  const session = await queryOne<UserSession>(
    `SELECT 
       s.id_sesion,
       s.id_usuario,
       s.fecha_expiracion,
       u.cedula,
       u.nombres,
       u.apellidos,
       u.correo,
       u.id_perfil,
       u.id_local,
       u.debe_cambiar_password,
       u.activo,
       u.bloqueado
     FROM sesiones_usuario s
     JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.token_hash = ? 
       AND s.revocada = 0 
       AND s.fecha_expiracion > NOW()
       AND u.activo = 1 
       AND u.bloqueado = 0
     LIMIT 1`,
    [tokenHash]
  );

  if (!session) {
    return null;
  }

  return session;
}

/**
 * Revoca la sesión actual en la base de datos y borra la cookie
 */
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    const tokenHash = hashToken(sessionCookie.value);
    await execute(
      `UPDATE sesiones_usuario SET revocada = 1 WHERE token_hash = ?`,
      [tokenHash]
    );
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
