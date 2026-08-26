import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { transaction } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export const saleTransactionSchema = z.object({
  id_local: z.number().int().positive(),
  id_cliente: z.number().int().positive().nullable(),
  id_canal: z.number().int().positive(),
  descuento: z.number().min(0).max(999999.99),
  observaciones: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        id_variante: z.number().int().positive(),
        cantidad: z.number().positive().max(999999),
      })
    )
    .min(1)
    .max(100),
  pagos: z
    .array(
      z.object({
        id_forma_pago: z.number().int().positive(),
        valor: z.number().positive().max(999999.99),
        referencia: z.string().trim().max(150).nullable(),
      })
    )
    .min(1)
    .max(10),
});

export type SaleTransactionInput = z.infer<typeof saleTransactionSchema>;

type VariantRow = {
  id_variante: number;
  precio_venta: number;
  porcentaje_iva: number;
};

type PaymentRow = {
  codigo: string;
  requiere_referencia: number | boolean;
};

type StockRow = {
  id_stock: number;
  id_bodega: number;
  cantidad: number;
};

export async function createSaleTransaction(input: SaleTransactionInput) {
  const context = await requirePermission("VENTA_CREAR");
  const parsed = saleTransactionSchema.parse(input);

  const variantIds = parsed.items.map((i) => i.id_variante);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new Error("No se permiten variantes duplicadas en la misma venta.");
  }

  return transaction(async (conn) => {
    // 1. Validar variantes y calcular total bruto
    let totalBruto = 0;
    const variantDetails: Array<{
      id_variante: number;
      cantidad: number;
      precio_venta: number;
      porcentaje_iva: number;
    }> = [];

    for (const item of parsed.items) {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT vp.id_variante, vp.precio_venta, vp.porcentaje_iva 
         FROM variantes_producto vp
         JOIN productos p ON p.id_producto = vp.id_producto
         WHERE vp.id_variante = ? AND vp.activo = 1 AND p.activo = 1 
         FOR SHARE`,
        [item.id_variante]
      );

      const variantData = rows?.[0] as VariantRow | undefined;

      if (!variantData || Number(variantData.precio_venta) <= 0) {
        throw new Error("Producto inactivo o con precio inválido.");
      }

      const precio = Number(variantData.precio_venta);
      const iva = Number(variantData.porcentaje_iva);
      const lineaBruta = Math.round(precio * item.cantidad * 100) / 100;
      totalBruto += lineaBruta;

      variantDetails.push({
        id_variante: item.id_variante,
        cantidad: item.cantidad,
        precio_venta: precio,
        porcentaje_iva: iva,
      });
    }

    totalBruto = Math.round(totalBruto * 100) / 100;
    const descuentoTotal = Math.round(Number(parsed.descuento || 0) * 100) / 100;

    if (descuentoTotal > totalBruto) {
      throw new Error("El descuento no puede superar el valor total de la venta.");
    }

    const totalVenta = Math.round((totalBruto - descuentoTotal) * 100) / 100;

    // 2. Validar formas de pago
    let pagoTotal = 0;
    for (const pago of parsed.pagos) {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT codigo, requiere_referencia FROM formas_pago WHERE id_forma_pago = ? AND activo = 1`,
        [pago.id_forma_pago]
      );

      const forma = rows?.[0] as PaymentRow | undefined;

      if (!forma || pago.valor <= 0) {
        throw new Error("Forma de pago o valor inválido.");
      }

      if (forma.codigo === "MIXTO") {
        throw new Error("Mixto debe desglosarse en formas de pago individuales.");
      }
      if (forma.requiere_referencia && (!pago.referencia || pago.referencia.trim().length < 3)) {
        throw new Error("La referencia de pago es obligatoria.");
      }
      if (forma.codigo === "CREDITO_INTERNO" && !parsed.id_cliente) {
        throw new Error("El crédito interno requiere un cliente seleccionado.");
      }

      pagoTotal += Math.round(pago.valor * 100) / 100;
    }

    pagoTotal = Math.round(pagoTotal * 100) / 100;
    if (Math.abs(pagoTotal - totalVenta) > 0.01) {
      throw new Error(`La suma de pagos ($${pagoTotal}) no coincide con el total ($${totalVenta}).`);
    }

    // 3. Calcular subtotales e impuestos por línea
    let subtotalGeneral = 0;
    let ivaGeneral = 0;
    let descuentoAsignado = 0;
    const totalItemsCount = variantDetails.length;

    const calculatedLines = variantDetails.map((v, index) => {
      const lineaBruta = Math.round(v.precio_venta * v.cantidad * 100) / 100;
      const isLast = index === totalItemsCount - 1;
      const lineaDescuento = isLast
        ? Math.round((descuentoTotal - descuentoAsignado) * 100) / 100
        : Math.round(((descuentoTotal * lineaBruta) / (totalBruto || 1)) * 100) / 100;

      descuentoAsignado += lineaDescuento;
      const lineaTotal = Math.round((lineaBruta - lineaDescuento) * 100) / 100;
      const lineaSubtotal = Math.round((lineaTotal / (1 + v.porcentaje_iva / 100)) * 100) / 100;
      const lineaIva = Math.round((lineaTotal - lineaSubtotal) * 100) / 100;

      subtotalGeneral += lineaSubtotal;
      ivaGeneral += lineaIva;

      return {
        ...v,
        descuento: lineaDescuento,
        subtotal: lineaSubtotal,
        iva: lineaIva,
        total: lineaTotal,
      };
    });

    subtotalGeneral = Math.round(subtotalGeneral * 100) / 100;
    ivaGeneral = Math.round(ivaGeneral * 100) / 100;
    if (Math.round((subtotalGeneral + ivaGeneral) * 100) / 100 !== totalVenta) {
      ivaGeneral = Math.round((totalVenta - subtotalGeneral) * 100) / 100;
    }

    // 4. Generar número de venta e insertar cabecera
    const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const randomHex = randomBytes(3).toString("hex").toUpperCase();
    const numeroVenta = `V-${dateStr}-${randomHex}`;

    const [saleRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO ventas (
         numero_venta,
         id_local,
         id_cliente,
         id_canal,
         id_usuario,
         fecha,
         subtotal,
         descuento,
         iva,
         total,
         observaciones,
         estado
       ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'REGISTRADA')`,
      [
        numeroVenta,
        parsed.id_local,
        parsed.id_cliente,
        parsed.id_canal,
        context.id_usuario,
        subtotalGeneral,
        descuentoTotal,
        ivaGeneral,
        totalVenta,
        parsed.observaciones?.trim() || null,
      ]
    );

    const saleId = Number(saleRes.insertId);

    // 5. Insertar detalle de venta y descontar inventario
    for (const line of calculatedLines) {
      await conn.execute(
        `INSERT INTO detalle_ventas (
           id_venta,
           id_variante,
           cantidad,
           precio_unitario,
           descuento,
           porcentaje_iva,
           subtotal,
           iva,
           total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          line.id_variante,
          line.cantidad,
          line.precio_venta,
          line.descuento,
          line.porcentaje_iva,
          line.subtotal,
          line.iva,
          line.total,
        ]
      );

      // Descontar inventario de bodegas activas del local
      const [warehouseStocks] = await conn.execute<RowDataPacket[]>(
        `SELECT sp.id_stock, sp.id_bodega, sp.cantidad 
         FROM stock_producto sp
         JOIN bodegas b ON b.id_bodega = sp.id_bodega
         WHERE sp.id_variante = ? AND b.id_local = ? AND b.activo = 1 AND sp.cantidad > 0
         ORDER BY sp.cantidad DESC
         FOR UPDATE`,
        [line.id_variante, parsed.id_local]
      );

      let restante = line.cantidad;
      for (const stock of (warehouseStocks as unknown as StockRow[]) || []) {
        if (restante <= 0) break;
        const cantDisponible = Number(stock.cantidad);
        const tomar = Math.min(restante, cantDisponible);
        const stockNuevo = cantDisponible - tomar;

        // Actualizar stock
        await conn.execute(
          `UPDATE stock_producto SET cantidad = ?, fecha_actualizacion = NOW() WHERE id_stock = ?`,
          [stockNuevo, stock.id_stock]
        );

        // Registrar movimiento
        await conn.execute(
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
           ) VALUES (?, ?, 'VENTA', ?, ?, ?, ?, 'VENTA', ?, ?, NOW())`,
          [
            line.id_variante,
            stock.id_bodega,
            tomar,
            cantDisponible,
            stockNuevo,
            `Venta ${numeroVenta}`,
            saleId,
            context.id_usuario,
          ]
        );

        restante -= tomar;
      }

      if (restante > 0) {
        throw new Error(`Stock insuficiente en el local para la variante ${line.id_variante}.`);
      }
    }

    // 6. Insertar pagos
    for (const pago of parsed.pagos) {
      await conn.execute(
        `INSERT INTO pagos_venta (
           id_venta,
           id_forma_pago,
           valor,
           referencia,
           fecha
         ) VALUES (?, ?, ?, ?, NOW())`,
        [saleId, pago.id_forma_pago, pago.valor, pago.referencia?.trim() || null]
      );
    }

    return { id: saleId, number: numeroVenta, total: totalVenta };
  });
}
