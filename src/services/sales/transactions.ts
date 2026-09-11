import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { transaction } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";
import { applyStockMovement } from "@/src/services/inventory/apply-stock-movement";

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
    // 0. Obtener porcentajes de comisión de parámetros_sistema
    const [paramRows] = await conn.execute<RowDataPacket[]>(
      `SELECT codigo, valor FROM parametros_sistema WHERE codigo IN ('COMISION_ASESOR', 'COMISION_LOCAL')`
    );
    const paramMap = new Map<string, number>();
    for (const r of (paramRows || []) as { codigo: string; valor: string }[]) {
      paramMap.set(r.codigo, Number(r.valor));
    }
    const pctAsesor = paramMap.get("COMISION_ASESOR") ?? 60;
    const pctLocal = paramMap.get("COMISION_LOCAL") ?? 40;

    // 1. Validar variantes y calcular total bruto
    let totalBruto = 0;
    let sumaDescuentosItems = 0;
    const variantDetails: Array<{
      id_variante: number;
      cantidad: number;
      precio_venta: number;
      costo_unitario: number;
      porcentaje_iva: number;
      item_descuento: number;
    }> = [];

    for (const item of parsed.items) {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT vp.id_variante, vp.precio_venta, vp.porcentaje_iva,
                COALESCE(NULLIF(vp.costo_unitario, 0), (
                  SELECT ROUND(dc.total / dc.cantidad, 2) 
                  FROM detalle_compras dc 
                  JOIN compras comp ON comp.id_compra = dc.id_compra 
                  WHERE dc.id_variante = vp.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                  ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC LIMIT 1
                ), 0.00) AS costo_unitario
         FROM variantes_producto vp
         JOIN productos p ON p.id_producto = vp.id_producto
         WHERE vp.id_variante = ? AND vp.activo = 1 AND p.activo = 1`,
        [item.id_variante]
      );

      const variantData = rows?.[0] as (VariantRow & { costo_unitario?: number }) | undefined;

      if (!variantData || Number(variantData.precio_venta) <= 0) {
        throw new Error("Producto inactivo o con precio inválido.");
      }

      const precio = Number(variantData.precio_venta);
      const costo = Number(variantData.costo_unitario) || 0;
      const iva = Number(variantData.porcentaje_iva);
      const lineaBruta = Math.round(precio * item.cantidad * 100) / 100;
      const itemDesc = Math.min(lineaBruta, Math.round((item.descuento || 0) * 100) / 100);

      totalBruto += lineaBruta;
      sumaDescuentosItems += itemDesc;

      variantDetails.push({
        id_variante: item.id_variante,
        cantidad: item.cantidad,
        precio_venta: precio,
        costo_unitario: costo,
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

    // 3. Calcular subtotales, impuestos, costos y utilidades por línea
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
      const lineaCostoTotal = Math.round(v.costo_unitario * v.cantidad * 100) / 100;
      const lineaUtilidad = Math.max(0, Math.round((lineaTotal - lineaCostoTotal) * 100) / 100);

      subtotalGeneral += lineaSubtotal;
      ivaGeneral += lineaIva;

      return {
        ...v,
        descuento: lineaDescuento,
        subtotal: lineaSubtotal,
        iva: lineaIva,
        total: lineaTotal,
        costo_total: lineaCostoTotal,
        utilidad: lineaUtilidad,
      };
    });

    subtotalGeneral = Math.round(subtotalGeneral * 100) / 100;
    ivaGeneral = Math.round(ivaGeneral * 100) / 100;
    if (Math.round((subtotalGeneral + ivaGeneral) * 100) / 100 !== totalVenta) {
      ivaGeneral = Math.round((totalVenta - subtotalGeneral) * 100) / 100;
    }

    // Totales calculados de la venta (fuente única de verdad)
    const totalCostoVenta = Math.round(calculatedLines.reduce((sum, l) => sum + l.costo_total, 0) * 100) / 100;
    const utilidadVenta = Math.max(0, Math.round((totalVenta - totalCostoVenta) * 100) / 100);
    const comisionAsesor = Math.round(utilidadVenta * (pctAsesor / 100) * 100) / 100;
    const comisionLocal = Math.round(utilidadVenta * (pctLocal / 100) * 100) / 100;

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
         costo_total,
         utilidad,
         comision_asesor,
         comision_local,
         observaciones,
         estado
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTRADA')`,
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
        totalCostoVenta,
        utilidadVenta,
        comisionAsesor,
        comisionLocal,
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
           total,
           costo_unitario,
           costo_total,
           utilidad
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          line.costo_unitario || 0,
          line.costo_total || 0,
          line.utilidad || 0,
        ]
      );

      // 1. Obtener existencias bloqueadas con FOR UPDATE exclusivamente en bodegas activas del local
      const [warehouseStocks] = await conn.execute<RowDataPacket[]>(
        `SELECT sp.id_stock, sp.id_bodega, sp.cantidad, b.nombre AS bodega_nombre
         FROM stock_producto sp
         JOIN bodegas b ON b.id_bodega = sp.id_bodega
         WHERE sp.id_variante = ? AND b.id_local = ? AND b.activo = 1
         ORDER BY sp.cantidad DESC, sp.id_bodega ASC
         FOR UPDATE`,
        [line.id_variante, parsed.id_local]
      );

      const availableStocks = (warehouseStocks as unknown as StockRow[]) || [];
      const totalDisponible = availableStocks.reduce((sum, s) => sum + Math.max(0, Number(s.cantidad) || 0), 0);

      // 2. REGLA ESTRICTA: NO PERMITIR VENTA CON STOCK INSUFICIENTE NI STOCK NEGATIVO
      if (totalDisponible < line.cantidad) {
        throw new Error(
          `Stock insuficiente para el producto seleccionado en el local #${parsed.id_local}. Disponible: ${totalDisponible}, requerido: ${line.cantidad}. No se permite generar existencias negativas.`
        );
      }

      // 3. Descontar aplicando movimientos oficiales mediante applyStockMovement
      let restante = line.cantidad;
      for (const stock of availableStocks) {
        if (restante <= 0) break;
        const cantDisponible = Number(stock.cantidad) || 0;
        if (cantDisponible <= 0) continue;

        const tomar = Math.min(restante, cantDisponible);

        await applyStockMovement({
          connection: conn,
          idVariante: line.id_variante,
          idBodega: stock.id_bodega,
          tipo: "VENTA",
          cantidad: tomar,
          referenciaTipo: "VENTA",
          referenciaId: saleId,
          motivo: `Venta #${numeroVenta}`,
          usuarioId: context.id_usuario,
        });

        restante -= tomar;
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

export async function annulSaleTransaction(saleId: number, motivo?: string) {
  const context = await requirePermission("VENTA_ANULAR");

  if (!saleId || isNaN(saleId) || saleId <= 0) {
    throw new Error("Identificador de venta inválido.");
  }

  return transaction(async (conn) => {
    // 1. Obtener la cabecera de la venta con bloqueo FOR UPDATE
    const [saleRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_venta, numero_venta, id_local, total, estado, observaciones
       FROM ventas 
       WHERE id_venta = ? 
       FOR UPDATE`,
      [saleId]
    );

    const sale = saleRows?.[0] as
      | {
          id_venta: number;
          numero_venta: string;
          id_local: number;
          total: number;
          estado: string;
          observaciones: string | null;
        }
      | undefined;

    if (!sale) {
      throw new Error("La venta solicitada no existe.");
    }

    if (sale.estado?.toUpperCase() === "ANULADA") {
      throw new Error("Esta venta ya se encuentra anulada.");
    }

    // 2. Obtener los detalles de la venta (ítems vendidos)
    const [detailRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_detalle, id_variante, cantidad 
       FROM detalle_ventas 
       WHERE id_venta = ?`,
      [saleId]
    );

    const items = (detailRows || []) as {
      id_detalle: number;
      id_variante: number;
      cantidad: number;
    }[];

    // 3. Revisar si existen movimientos previos de tipo 'VENTA' para esta venta en el kardex
    const [movRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_variante, id_bodega, cantidad 
       FROM movimientos_inventario 
       WHERE referencia_tipo = 'VENTA' AND referencia_id = ? AND tipo = 'VENTA'`,
      [saleId]
    );

    const previousMovements = (movRows || []) as {
      id_variante: number;
      id_bodega: number;
      cantidad: number;
    }[];

    // Mapear variantes a bodegas donde se descontó
    const bodegaPorVariante = new Map<number, Array<{ id_bodega: number; cantidad: number }>>();
    for (const mov of previousMovements) {
      const list = bodegaPorVariante.get(mov.id_variante) || [];
      list.push({ id_bodega: mov.id_bodega, cantidad: Number(mov.cantidad) });
      bodegaPorVariante.set(mov.id_variante, list);
    }

    // Obtener bodega de fallback del local si no hubiera historial en movimientos_inventario
    let fallbackBodegaId = 1;
    const [bodegaFallbackRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id_bodega FROM bodegas WHERE (id_local = ? OR id_local = 1) AND activo = 1 ORDER BY (id_local = ?) DESC LIMIT 1`,
      [sale.id_local || 1, sale.id_local || 1]
    );
    if (bodegaFallbackRows && bodegaFallbackRows.length > 0) {
      fallbackBodegaId = Number((bodegaFallbackRows[0] as { id_bodega: number }).id_bodega) || 1;
    }

    // 4. Reintegrar stock por cada ítem
    for (const item of items) {
      const cantTotal = Number(item.cantidad);
      const prevDeductions = bodegaPorVariante.get(item.id_variante);

      let distribucion: Array<{ id_bodega: number; cantidad: number }> = [];
      if (prevDeductions && prevDeductions.length > 0) {
        distribucion = prevDeductions;
      } else {
        distribucion = [{ id_bodega: fallbackBodegaId, cantidad: cantTotal }];
      }

      for (const dist of distribucion) {
        await applyStockMovement({
          connection: conn,
          idVariante: item.id_variante,
          idBodega: dist.id_bodega,
          tipo: "DEVOLUCION_CLIENTE",
          cantidad: dist.cantidad,
          referenciaTipo: "VENTA",
          referenciaId: saleId,
          motivo: `Anulación de venta #${sale.numero_venta}${motivo ? `: ${motivo}` : ""}`,
          usuarioId: context.id_usuario,
        });
      }
    }

    // 5. Actualizar estado de la venta a ANULADA
    const fechaHoraStr = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
    const userNombre = `${context.nombres || ""} ${context.apellidos || ""}`.trim() || `Usuario #${context.id_usuario}`;
    const notaAnulacion = `\n[ANULADA el ${fechaHoraStr} por ${userNombre}${motivo ? ` - Motivo: ${motivo}` : ""}]`;
    const observacionesActualizadas = `${sale.observaciones || ""}${notaAnulacion}`.trim();

    await conn.execute(
      `UPDATE ventas 
       SET estado = 'ANULADA', observaciones = ? 
       WHERE id_venta = ?`,
      [observacionesActualizadas, saleId]
    );

    // 6. Registrar en auditoría
    await conn.execute(
      `INSERT INTO auditoria (
         usuario,
         tabla_afectada,
         accion,
         registro_id,
         valor_anterior,
         valor_nuevo,
         fecha
       ) VALUES (?, 'ventas', 'ANULACION', ?, ?, ?, NOW())`,
      [
        context.id_usuario,
        saleId,
        JSON.stringify({ estado: sale.estado, total: sale.total }),
        JSON.stringify({ estado: "ANULADA", motivo: motivo || null, fecha: new Date().toISOString() }),
      ]
    ).catch((e) => console.error("Error insertando auditoria:", e));

    return { success: true, numero_venta: sale.numero_venta };
  });
}

