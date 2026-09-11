import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  type InventoryMovementType,
  getMovementFactor,
  normalizeMovementType,
} from "@/src/services/inventory/types";

export interface ApplyStockMovementParams {
  connection: PoolConnection;
  idVariante: number;
  idBodega: number;
  tipo: InventoryMovementType | string;
  cantidad: number;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  motivo?: string | null;
  usuarioId?: number | null;
  idempotencyKey?: string | null;
}

export interface ApplyStockMovementResult {
  idMovimiento: number;
  stockAnterior: number;
  stockNuevo: number;
  idStock: number;
}

/**
 * SERVICIO CENTRAL Y ÚNICO DE APLICACIÓN DE MOVIMIENTOS DE INVENTARIO
 *
 * Esta función es la ÚNICA responsable en todo el sistema de:
 * 1. Bloquear el registro con SELECT ... FOR UPDATE.
 * 2. Obtener y validar el stock anterior real.
 * 3. Validar que ninguna salida deje el inventario negativo.
 * 4. Actualizar `stock_producto`.
 * 5. Registrar el movimiento inmutable en `movimientos_inventario`.
 */
export async function applyStockMovement(
  params: ApplyStockMovementParams
): Promise<ApplyStockMovementResult> {
  const {
    connection: conn,
    idVariante,
    idBodega,
    referenciaTipo = null,
    referenciaId = null,
    motivo = null,
    usuarioId = null,
  } = params;

  if (!idVariante || idVariante <= 0) {
    throw new Error("applyStockMovement: idVariante inválido o no proporcionado.");
  }
  if (!idBodega || idBodega <= 0) {
    throw new Error("applyStockMovement: idBodega inválido o no proporcionado.");
  }

  const rawCantidad = Number(params.cantidad);
  if (isNaN(rawCantidad) || rawCantidad <= 0) {
    throw new Error(`applyStockMovement: La cantidad debe ser un número positivo (> 0). Recibido: ${params.cantidad}`);
  }

  // Redondear a 4 decimales de precisión
  const cantidad = Math.round(rawCantidad * 10000) / 10000;
  const tipo = normalizeMovementType(params.tipo);
  const factor = getMovementFactor(tipo);

  // 1. Bloquear registro de stock para la variante y bodega con FOR UPDATE
  const [stockRows] = await conn.execute<RowDataPacket[]>(
    `SELECT id_stock, cantidad 
     FROM stock_producto 
     WHERE id_variante = ? AND id_bodega = ? 
     FOR UPDATE`,
    [idVariante, idBodega]
  );

  let idStock: number;
  let stockAnterior = 0;

  if (!stockRows || stockRows.length === 0) {
    // Si no existe fila en stock_producto:
    if (factor < 0) {
      throw new Error(
        `Stock insuficiente: No existe inventario registrado para la variante #${idVariante} en la bodega #${idBodega}.`
      );
    }

    // Para entradas, crear la fila inicial con saldo 0
    const [insertStockRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
       VALUES (?, ?, 0.00, NOW())`,
      [idVariante, idBodega]
    );
    idStock = Number(insertStockRes.insertId);
    stockAnterior = 0;
  } else {
    const row = stockRows[0] as { id_stock: number; cantidad: number };
    idStock = Number(row.id_stock);
    stockAnterior = Math.round((Number(row.cantidad) || 0) * 10000) / 10000;
  }

  // 2. Validar que la salida no supere el stock disponible
  if (factor < 0 && stockAnterior < cantidad) {
    throw new Error(
      `Stock insuficiente para variante #${idVariante} en bodega #${idBodega}. Disponible: ${stockAnterior}, requerido: ${cantidad}.`
    );
  }

  // 3. Calcular nuevo saldo asegurando que nunca sea negativo
  let stockNuevo = Math.round((stockAnterior + factor * cantidad) * 10000) / 10000;
  if (stockNuevo < -0.0001) {
    throw new Error(
      `Violación de consistencia: La operación resultaría en stock negativo (${stockNuevo}) para variante #${idVariante}.`
    );
  }
  if (Math.abs(stockNuevo) < 0.0001) {
    stockNuevo = 0;
  }

  // 4. Actualizar stock materializado
  await conn.execute(
    `UPDATE stock_producto 
     SET cantidad = ?, fecha_actualizacion = NOW() 
     WHERE id_stock = ?`,
    [stockNuevo, idStock]
  );

  // 5. Registrar movimiento en kardex (cantidad SIEMPRE POSITIVA)
  const [movRes] = await conn.execute<ResultSetHeader>(
    `INSERT INTO movimientos_inventario (
       id_variante,
       id_bodega,
       tipo,
       cantidad,
       stock_anterior,
       stock_nuevo,
       motivo,
       referencia_tipo,
       referencia_id,
       usuario,
       fecha
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      idVariante,
      idBodega,
      tipo,
      cantidad,
      stockAnterior,
      stockNuevo,
      motivo,
      referenciaTipo,
      referenciaId,
      usuarioId,
    ]
  );

  const idMovimiento = Number(movRes.insertId);

  return {
    idMovimiento,
    stockAnterior,
    stockNuevo,
    idStock,
  };
}
