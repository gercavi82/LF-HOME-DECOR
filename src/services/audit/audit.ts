import "server-only";

import { execute } from "@/src/lib/db/mysql";

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

/** Registra eventos de negocio en la tabla auditoria. Nunca debe recibir contrasenas ni secretos. */
export async function recordAuditEvent(event: AuditEvent): Promise<boolean> {
  try {
    await execute(
      `INSERT INTO auditoria (
         usuario,
         tabla_afectada,
         accion,
         registro_id,
         valor_anterior,
         valor_nuevo,
         fecha
       ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        event.userId ?? null,
        event.table.slice(0, 100),
        event.action,
        event.recordId ?? null,
        event.previousValue ? JSON.stringify(event.previousValue) : null,
        event.newValue ? JSON.stringify(event.newValue) : null,
      ]
    );

    return true;
  } catch (error) {
    console.error("MySQL audit event ERROR:", error);
    return false;
  }
}
