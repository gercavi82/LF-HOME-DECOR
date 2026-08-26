import "server-only";

import bcrypt from "bcryptjs";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? "12");

/** Hash de contraseña con bcrypt. */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, ROUNDS);
}

/** Verifica una contraseña contra su hash bcrypt. */
export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
