import "server-only";

import { z } from "zod";
import { queryOne } from "@/src/lib/db/mysql";

const cedulaSchema = z.string().trim().regex(/^\d{10}$/, "Cédula inválida");

export type ResolvedUser = {
  id_usuario: number;
  id_perfil: number;
  id_local: number | null;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  password_hash: string;
  debe_cambiar_password: boolean;
  intentos_fallidos: number;
  activo: boolean;
  bloqueado: boolean;
  ultimo_acceso: string | null;
};

export async function resolveUserByCedula(
  cedula: string,
): Promise<ResolvedUser | null> {
  const parsedCedula = cedulaSchema.safeParse(cedula);

  if (!parsedCedula.success) {
    return null;
  }

  try {
    const user = await queryOne<ResolvedUser>(
      `SELECT 
         id_usuario,
         id_perfil,
         id_local,
         cedula,
         nombres,
         apellidos,
         correo,
         telefono,
         password_hash,
         debe_cambiar_password,
         intentos_fallidos,
         bloqueado,
         activo,
         ultimo_acceso
       FROM usuarios
       WHERE cedula = ?
       LIMIT 1`,
      [parsedCedula.data]
    );

    return user;
  } catch (error) {
    console.error("MySQL resolveUserByCedula ERROR:", error);
    throw new Error("No fue posible consultar el usuario interno.");
  }
}
