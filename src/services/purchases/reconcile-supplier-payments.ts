import "server-only";

import { query, transaction, execute } from "@/src/lib/db/mysql";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export type SupplierReconciliationResult = {
  idProveedor: number;
  proveedorNombre: string;
  totalCompras: number;
  totalComprasMonto: number;
  totalAbonado: number;
  totalPendiente: number;
  totalDepositos: number;
  totalAplicado: number;
  depositosDisponibles: number;
  aplicacionesGeneradas: number;
};

/**
 * Reconcilia de forma atómica e idempotente los depósitos y compras de un proveedor
 * aplicando la regla de negocio FIFO (primero la compra más antigua).
 *
 * @param idProveedor ID del proveedor a conciliar
 * @param userId ID del usuario que originó la operación (opcional para auditoría)
 * @param externalConn Conexión transaccional externa (opcional)
 */
export async function reconcileSupplierPayments(
  idProveedor: number,
  userId?: number,
  externalConn?: PoolConnection
): Promise<SupplierReconciliationResult> {
  const runner = async (conn: PoolConnection): Promise<SupplierReconciliationResult> => {
    // 0. Obtener datos del proveedor
    const [provRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_proveedor, nombre FROM proveedores WHERE id_proveedor = ? LIMIT 1`,
      [idProveedor]
    );
    const proveedorNombre = (provRows?.[0] as { nombre?: string })?.nombre || `Proveedor #${idProveedor}`;

    // 1. Bloquear compras activas del proveedor en orden FIFO (fecha ASC, id_compra ASC)
    const [purchaseRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_compra, total, fecha, numero_compra
       FROM compras
       WHERE id_proveedor = ? AND UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO')
       ORDER BY fecha ASC, id_compra ASC
       FOR UPDATE`,
      [idProveedor]
    );

    // 2. Bloquear depósitos/abonos activos del proveedor en orden FIFO (fecha ASC, id_pago_compra ASC)
    const [paymentRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_pago_compra, monto, fecha, referencia
       FROM pagos_compras
       WHERE (id_proveedor = ? OR (id_proveedor IS NULL AND ? = 1)) AND activo = 1
       ORDER BY fecha ASC, id_pago_compra ASC
       FOR UPDATE`,
      [idProveedor, idProveedor]
    );

    // 3. Eliminar aplicaciones anteriores de este proveedor para reconstrucción limpia e idempotente
    await conn.execute(
      `DELETE FROM aplicaciones_abonos_proveedor WHERE id_proveedor = ?`,
      [idProveedor]
    );

    // 4. Preparar estructuras de memoria para FIFO
    const purchases = (purchaseRows || []).map((r) => ({
      id_compra: Number(r.id_compra),
      total: Math.round(Number(r.total) * 100) / 100,
      totalAbonado: 0,
    }));

    const payments = (paymentRows || []).map((r) => ({
      id_pago_compra: Number(r.id_pago_compra),
      monto: Math.round(Number(r.monto) * 100) / 100,
      disponible: Math.round(Number(r.monto) * 100) / 100,
      aplicado: 0,
    }));

    let aplicacionesCount = 0;

    // 5. Algoritmo de asignación FIFO
    for (const payment of payments) {
      if (payment.disponible <= 0) continue;

      for (const purchase of purchases) {
        const saldoPendienteCompra = Math.round((purchase.total - purchase.totalAbonado) * 100) / 100;
        if (saldoPendienteCompra <= 0) continue;

        const montoAplicar = Math.round(Math.min(payment.disponible, saldoPendienteCompra) * 100) / 100;

        if (montoAplicar > 0) {
          // Registrar aplicación N:M
          await conn.execute(
            `INSERT INTO aplicaciones_abonos_proveedor (
               id_pago_cuenta, id_compra, id_proveedor, monto_aplicado, creado_por, fecha_aplicacion, activo
             ) VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
            [payment.id_pago_compra, purchase.id_compra, idProveedor, montoAplicar, userId || null]
          );

          aplicacionesCount++;
          payment.disponible = Math.round((payment.disponible - montoAplicar) * 100) / 100;
          payment.aplicado = Math.round((payment.aplicado + montoAplicar) * 100) / 100;
          purchase.totalAbonado = Math.round((purchase.totalAbonado + montoAplicar) * 100) / 100;
        }

        if (payment.disponible <= 0) {
          break; // Depósito agotado, pasar al siguiente depósito
        }
      }
    }

    // 6. Actualizar totales y estado en cada compra
    for (const purchase of purchases) {
      const saldoPendiente = Math.max(0, Math.round((purchase.total - purchase.totalAbonado) * 100) / 100);
      let estadoPago: "PAGADA" | "ABONO_PARCIAL" | "PENDIENTE" = "PENDIENTE";

      if (purchase.totalAbonado <= 0) {
        estadoPago = "PENDIENTE";
      } else if (saldoPendiente <= 0.005) {
        estadoPago = "PAGADA";
      } else {
        estadoPago = "ABONO_PARCIAL";
      }

      await conn.execute(
        `UPDATE compras 
         SET total_abonado = ?, 
             saldo_pendiente = ?, 
             estado_pago = ? 
         WHERE id_compra = ?`,
        [purchase.totalAbonado, saldoPendiente, estadoPago, purchase.id_compra]
      );
    }

    // 7. Actualizar montos aplicados y saldos disponibles en cada depósito/abono
    for (const payment of payments) {
      await conn.execute(
        `UPDATE pagos_compras 
         SET id_proveedor = ?, 
             monto_aplicado = ?, 
             saldo_disponible = ? 
         WHERE id_pago_compra = ?`,
        [idProveedor, payment.aplicado, payment.disponible, payment.id_pago_compra]
      );
    }

    // 8. Totales consolidados para retorno
    const totalComprasMonto = Math.round(purchases.reduce((s, p) => s + p.total, 0) * 100) / 100;
    const totalAbonado = Math.round(purchases.reduce((s, p) => s + p.totalAbonado, 0) * 100) / 100;
    const totalPendiente = Math.max(0, Math.round((totalComprasMonto - totalAbonado) * 100) / 100);
    const totalDepositos = Math.round(payments.reduce((s, p) => s + p.monto, 0) * 100) / 100;
    const totalAplicado = Math.round(payments.reduce((s, p) => s + p.aplicado, 0) * 100) / 100;
    const depositosDisponibles = Math.max(0, Math.round((totalDepositos - totalAplicado) * 100) / 100);

    return {
      idProveedor,
      proveedorNombre,
      totalCompras: purchases.length,
      totalComprasMonto,
      totalAbonado,
      totalPendiente,
      totalDepositos,
      totalAplicado,
      depositosDisponibles,
      aplicacionesGeneradas: aplicacionesCount,
    };
  };

  if (externalConn) {
    return runner(externalConn);
  } else {
    return transaction(runner);
  }
}

/**
 * Reconcilia todos los proveedores existentes en el sistema
 */
export async function reconcileAllSuppliers(userId?: number): Promise<SupplierReconciliationResult[]> {
  const supplierRows = await query<{ id_proveedor: number }>(
    `SELECT DISTINCT id_proveedor FROM proveedores WHERE activo = 1
     UNION
     SELECT DISTINCT id_proveedor FROM compras WHERE id_proveedor IS NOT NULL
     UNION
     SELECT DISTINCT id_proveedor FROM pagos_compras WHERE id_proveedor IS NOT NULL`
  ).catch(() => []);

  const results: SupplierReconciliationResult[] = [];
  const uniqueSupplierIds = Array.from(
    new Set((supplierRows ?? []).map((r) => Number(r.id_proveedor)).filter((id) => id > 0))
  );

  if (uniqueSupplierIds.length === 0) {
    uniqueSupplierIds.push(1); // Proveedor Matriz por defecto
  }

  for (const idProv of uniqueSupplierIds) {
    try {
      const res = await reconcileSupplierPayments(idProv, userId);
      results.push(res);
    } catch (err) {
      console.error(`Error reconciliando proveedor ${idProv}:`, err);
    }
  }

  return results;
}

/**
 * Obtiene el saldo de depósito disponible (no aplicado) de un proveedor
 */
export async function getSupplierAvailableDeposit(idProveedor: number): Promise<number> {
  const rows = await query<{ disponible: number }>(
    `SELECT COALESCE(SUM(saldo_disponible), 0) AS disponible 
     FROM pagos_compras 
     WHERE id_proveedor = ? AND activo = 1`,
    [idProveedor]
  ).catch(() => []);

  return Number(rows?.[0]?.disponible) || 0;
}
