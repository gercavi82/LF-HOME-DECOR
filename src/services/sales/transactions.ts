import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { transaction } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export const saleTransactionSchema = z.object({
  id_local: z.coerce.number().int().positive().default(1),
  id_cliente: z.coerce.number().int().nonnegative().nullable().optional(),
  id_canal: z.coerce.number().int().positive().default(1),
  id_usuario_asesor: z.coerce.number().int().positive().optional().nullable(),
  fecha: z.string().optional().nullable(),
  descuento: z.coerce.number().min(0).max(999999.99).default(0),
  observaciones: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        id_variante: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().positive().max(999999),
        descuento: z.coerce.number().min(0).max(999999.99).optional().default(0),
      })
    )
    .min(1)
    .max(100),
  pagos: z
    .array(
      z.object({
        id_forma_pago: z.coerce.number().int().positive(),
        valor: z.coerce.number().positive().max(999999.99),
        referencia: z.string().trim().max(150).nullable().optional(),
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
    let sumaDescuentosItems = 0;
    const variantDetails: Array<{
      id_variante: number;
      cantidad: number;
      precio_venta: number;
      porcentaje_iva: number;
      item_descuento: number;
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
      const itemDesc = Math.min(lineaBruta, Math.round((item.descuento || 0) * 100) / 100);

      totalBruto += lineaBruta;
      sumaDescuentosItems += itemDesc;

      variantDetails.push({
        id_variante: item.id_variante,
        cantidad: item.cantidad,
        precio_venta: precio,
        porcentaje_iva: iva,
        item_descuento: itemDesc,
      });
    }

    totalBruto = Math.round(totalBruto * 100) / 100;
    const globalDiscount = Math.round(Number(parsed.descuento || 0) * 100) / 100;
    const descuentoTotal = Math.min(totalBruto, Math.max(sumaDescuentosItems, globalDiscount));

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

      pagoTotal += Math.round(pago.valor * 100) / 100;
    }

    pagoTotal = Math.round(pagoTotal * 100) / 100;
    if (Math.abs(pagoTotal - totalVenta) > 0.05) {
      throw new Error(`La suma de pagos ($${pagoTotal.toFixed(2)}) no coincide con el total de la venta ($${totalVenta.toFixed(2)}).`);
    }

    // 3. Calcular subtotales e impuestos por línea
    let subtotalGeneral = 0;
    let ivaGeneral = 0;
    let descuentoAsignado = 0;
    const totalItemsCount = variantDetails.length;

    const calculatedLines = variantDetails.map((v, index) => {
      const lineaBruta = Math.round(v.precio_venta * v.cantidad * 100) / 100;
      const isLast = index === totalItemsCount - 1;
      
      let lineaDescuento = v.item_descuento;
      if (descuentoTotal > sumaDescuentosItems) {
        const restanteGlobal = descuentoTotal - sumaDescuentosItems;
        const extraDesc = isLast
          ? Math.round((descuentoTotal - descuentoAsignado - lineaDescuento) * 100) / 100
          : Math.round(((restanteGlobal * lineaBruta) / (totalBruto || 1)) * 100) / 100;
        lineaDescuento = Math.min(lineaBruta, lineaDescuento + Math.max(0, extraDesc));
      }

      descuentoAsignado += lineaDescuento;
      const lineaTotal = Math.max(0, Math.round((lineaBruta - lineaDescuento) * 100) / 100);
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

    let fechaVenta: Date;
    if (parsed.fecha && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      fechaVenta = new Date(`${parsed.fecha}T${timeStr}`);
    } else {
      fechaVenta = new Date();
    }

    const sellerUserId = parsed.id_usuario_asesor ? Number(parsed.id_usuario_asesor) : context.id_usuario;
    const finalCustomerId = (parsed.id_cliente && Number(parsed.id_cliente) > 0) ? Number(parsed.id_cliente) : null;

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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTRADA')`,
      [
        numeroVenta,
        parsed.id_local || 1,
        finalCustomerId,
        parsed.id_canal || 1,
        sellerUserId,
        fechaVenta,
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

      // Descontar inventario de bodegas activas
      const [warehouseStocks] = await conn.execute<RowDataPacket[]>(
        `SELECT sp.id_stock, sp.id_bodega, sp.cantidad 
         FROM stock_producto sp
         JOIN bodegas b ON b.id_bodega = sp.id_bodega
         WHERE sp.id_variante = ? AND (b.id_local = ? OR b.id_local = 1) AND b.activo = 1
         ORDER BY (b.id_local = ?) DESC, sp.cantidad DESC
         FOR UPDATE`,
        [line.id_variante, parsed.id_local || 1, parsed.id_local || 1]
      );

      let restante = line.cantidad;
      for (const stock of (warehouseStocks as unknown as StockRow[]) || []) {
        if (restante <= 0) break;
        const cantDisponible = Number(stock.cantidad);
        const tomar = Math.min(restante, cantDisponible > 0 ? cantDisponible : restante);
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
        ).catch(() => null);

        restante -= tomar;
      }

      // Si aún queda restante o no existía stock_producto, registrarlo en la bodega principal
      if (restante > 0) {
        const [bodegaRows] = await conn.execute<RowDataPacket[]>(
          `SELECT id_bodega FROM bodegas WHERE (id_local = ? OR id_local = 1) AND activo = 1 LIMIT 1`,
          [parsed.id_local || 1]
        );
        const bodegaId = (bodegaRows?.[0] as { id_bodega: number } | undefined)?.id_bodega || 1;
        await conn.execute(
          `INSERT INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion) 
           VALUES (?, ?, 0, NOW()) 
           ON DUPLICATE KEY UPDATE cantidad = cantidad - ?`,
          [line.id_variante, bodegaId, restante]
        ).catch(() => null);
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
