import { ZodError } from "zod";

export const ERROR_CODES = ["SUCCESS", "VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "DATABASE_ERROR", "INTERNAL_ERROR"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(public readonly code: Exclude<ErrorCode, "SUCCESS">, message: string, public readonly status = 500) { super(message); this.name = "AppError"; }
}

type DatabaseError = { code?: string | null; message?: string | null };
const businessCodes = new Set(["22023", "23503", "23514", "P0001"]);

export function fromDatabaseError(error: DatabaseError, fallback: string) {
  if (error.code === "23505") return new AppError("CONFLICT", "Ya existe un registro con esos datos.", 409);
  if (error.code === "42501") return new AppError("FORBIDDEN", "No tiene autorización para completar esta operación.", 403);
  if (error.code === "PGRST116") return new AppError("NOT_FOUND", "El registro solicitado no existe.", 404);
  if (error.code && businessCodes.has(error.code) && error.message && error.message.length <= 180) return new AppError("VALIDATION_ERROR", error.message, 400);
  return new AppError("DATABASE_ERROR", fallback, 500);
}

export function publicError(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  if (error instanceof ZodError) return { code: "VALIDATION_ERROR" as const, message: error.issues[0]?.message ?? "Revise los datos ingresados." };
  return { code: "INTERNAL_ERROR" as const, message: fallback };
}

export type ActionErrorState = { error?: string; code?: Exclude<ErrorCode, "SUCCESS"> };
