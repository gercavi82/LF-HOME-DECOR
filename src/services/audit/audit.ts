import "server-only";

import { createAdminClient } from "@/src/lib/supabase/admin";

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "CAMBIO_PASSWORD"
  | "AJUSTE_INVENTARIO"
  | "VENTA"
  | "ANULACION";

type AuditEvent = {
  userId: number | null;
  table: string;
  action: AuditAction;
  recordId?: number | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
};

/** Registra eventos de negocio. Nunca debe recibir contrasenas, tokens ni secretos. */
export async function recordAuditEvent(event: AuditEvent) {
  const admin = createAdminClient();
  const { error } = await admin.from("auditoria").insert({
    usuario: event.userId,
    tabla_afectada: event.table.slice(0, 100),
    accion: event.action,
    registro_id: event.recordId ?? null,
    valor_anterior: event.previousValue ?? null,
    valor_nuevo: event.newValue ?? null,
    fecha: new Date().toISOString(),
  });

  if (error) {
    console.error("SUPABASE audit event ERROR:", {
      code: error.code,
      message: error.message,
      action: event.action,
      table: event.table,
    });
    return false;
  }

  return true;
}
