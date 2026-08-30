import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requireAnyPermission } from "@/src/services/auth/authorization";
import { listExpenses } from "@/src/services/expenses/expenses";
import { ensureCustomTables } from "@/src/lib/db/ensure-tables";

export type MonthlySalesBreakdown = {
  year_month: string;
  label: string;
  unidades: number;
  total_ventas: number;
  total_costo: number;
  total_compras: number;
  utilidad: number;
  comision_asesores: number;
  comision_local: number;
  gastos: number;
  saldo_comision_local: number;
};

export type ProductTypeSalesBreakdown = {
  tipo: string;
  categoria: string;
  unidades: number;
  total_ventas: number;
  total_costo: number;
  utilidad: number;
  margen_porcentaje: number;
};

export type AdvisorReportItem = {
  id_usuario: number;
  asesor: string;
  cedula: string;
  correo: string;
  total_ventas: number;
  total_costo: number;
  total_utilidad: number;
  comision_asesor: number;
  comision_local: number;
  unidades_vendidas: number;
  comision_pagada: number;
  saldo_pendiente: number;
  estado_pago: "PAGADO" | "PENDIENTE" | "SIN_COMISION";
};

export type FinancialReportData = {
  filters: {
    year: string;
    month: string;
    tipoId: string;
  };
  availableYears: string[];
  availableTypes: Array<{ id: number; nombre: string }>;
  kpis: {
    totalVentas: number;
    totalCostos: number;
    utilidadBruta: number;
    gastosOperativos: number;
    utilidadNetaReal: number;
    totalUnidades: number;
    comisionesAsesores: number;
    comisionesLocal: number;
    saldoComisionLocal: number;
    comisionesPagadas: number;
    comisionesPendientes: number;
  };
  monthlyBreakdown: MonthlySalesBreakdown[];
  typeBreakdown: ProductTypeSalesBreakdown[];
  advisors: AdvisorReportItem[];
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

export async function getFinancialReport(filters?: {
  year?: string;
  month?: string;
  tipoId?: string;
}): Promise<FinancialReportData> {
  await requireAnyPermission(["REPORTES_VER", "FINANZAS_VER", "DASHBOARD_VER"]);
  await ensureCustomTables().catch(() => null);

  const selectedYear = filters?.year?.trim() || "";
  const selectedMonth = filters?.month?.trim() || "";
  const selectedTipoId = filters?.tipoId?.trim() || "";

  try {
    // 1. Obtener años disponibles de ventas
    const yearRows = await query<{ anio: string }>(
      `SELECT DISTINCT DATE_FORMAT(fecha, '%Y') AS anio FROM ventas WHERE fecha IS NOT NULL ORDER BY anio DESC`
    ).catch(() => []);
    const availableYears = (yearRows ?? []).map((r) => String(r.anio)).filter(Boolean);
    if (!availableYears.includes("2026")) {
      availableYears.push("2026");
    }

    // 2. Obtener tipos de producto disponibles
    const typeRows = await query<{ id: number; nombre: string }>(
      `SELECT id_tipo AS id, nombre FROM tipos_producto WHERE activo = 1 ORDER BY nombre ASC`
    ).catch(() => []);
    const availableTypes = (typeRows ?? []).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) }));

    // 3. Query base de ventas con joins a detalle y producto
    const whereClauses = ["UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')"];
    const params: unknown[] = [];

    if (selectedYear) {
      whereClauses.push(`DATE_FORMAT(v.fecha, '%Y') = ?`);
      params.push(selectedYear);
    }

    if (selectedMonth) {
      whereClauses.push(`DATE_FORMAT(v.fecha, '%m') = ?`);
      params.push(selectedMonth.padStart(2, "0"));
    }

    if (selectedTipoId && Number(selectedTipoId) > 0) {
      whereClauses.push(`prod.id_tipo = ?`);
      params.push(Number(selectedTipoId));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 4. Desglose Mensual de Ventas, Compras y Gastos
    const [monthlyRows, monthlyPurchaseRows, monthlyExpenseRows] = await Promise.all([
      query<{
        year_month: string;
        unidades: number;
        total_ventas: number;
        total_costo: number;
        utilidad: number;
        comision_asesor: number;
        comision_local: number;
      }>(
        `SELECT 
           DATE_FORMAT(s.fecha, '%Y-%m') AS year_month,
           COALESCE(SUM(s.unidades), 0) AS unidades,
           COALESCE(SUM(s.venta_total), 0) AS total_ventas,
           COALESCE(SUM(s.costo_total), 0) AS total_costo,
           COALESCE(SUM(s.utilidad), 0) AS utilidad,
           COALESCE(SUM(s.comision_asesor), 0) AS comision_asesor,
           COALESCE(SUM(s.comision_local), 0) AS comision_local
         FROM (
           SELECT 
             v.id_venta,
             v.fecha,
             v.total AS venta_total,
             COALESCE(SUM(d.cantidad), 1) AS unidades,
             COALESCE(SUM(
               COALESCE(
                 NULLIF(d.costo_unitario, 0),
                 NULLIF(vp.costo_unitario, 0),
                 (
                   SELECT ROUND(dc.total / dc.cantidad, 2) 
                   FROM detalle_compras dc 
                   JOIN compras comp ON comp.id_compra = dc.id_compra 
                   WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                   ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                   LIMIT 1
                 ),
                 ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
               ) * d.cantidad
             ), 0) AS costo_total,
             GREATEST(0, v.total - COALESCE(SUM(
               COALESCE(
                 NULLIF(d.costo_unitario, 0),
                 NULLIF(vp.costo_unitario, 0),
                 (
                   SELECT ROUND(dc.total / dc.cantidad, 2) 
                   FROM detalle_compras dc 
                   JOIN compras comp ON comp.id_compra = dc.id_compra 
                   WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                   ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                   LIMIT 1
                 ),
                 ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
               ) * d.cantidad
             ), 0)) AS utilidad,
             ROUND(GREATEST(0, v.total - COALESCE(SUM(
               COALESCE(
                 NULLIF(d.costo_unitario, 0),
                 NULLIF(vp.costo_unitario, 0),
                 (
                   SELECT ROUND(dc.total / dc.cantidad, 2) 
                   FROM detalle_compras dc 
                   JOIN compras comp ON comp.id_compra = dc.id_compra 
                   WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                   ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                   LIMIT 1
                 ),
                 ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
               ) * d.cantidad
             ), 0)) * 0.60, 2) AS comision_asesor,
             ROUND(GREATEST(0, v.total - COALESCE(SUM(
               COALESCE(
                 NULLIF(d.costo_unitario, 0),
                 NULLIF(vp.costo_unitario, 0),
                 (
                   SELECT ROUND(dc.total / dc.cantidad, 2) 
                   FROM detalle_compras dc 
                   JOIN compras comp ON comp.id_compra = dc.id_compra 
                   WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                   ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                   LIMIT 1
                 ),
                 ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
               ) * d.cantidad
             ), 0)) * 0.40, 2) AS comision_local
           FROM ventas v
           LEFT JOIN detalle_ventas d ON d.id_venta = v.id_venta
           LEFT JOIN variantes_producto vp ON vp.id_variante = d.id_variante
           LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
           WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
           ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
           GROUP BY v.id_venta
         ) s
         GROUP BY DATE_FORMAT(s.fecha, '%Y-%m')
         ORDER BY DATE_FORMAT(s.fecha, '%Y-%m') ASC`,
        params
      ).catch(() => []),
      query<{
        year_month: string;
        total_compras: number;
      }>(
        `SELECT 
           DATE_FORMAT(c.fecha, '%Y-%m') AS year_month,
           COALESCE(SUM(c.total), 0) AS total_compras
         FROM compras c
         WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
         GROUP BY DATE_FORMAT(c.fecha, '%Y-%m')
         ORDER BY DATE_FORMAT(c.fecha, '%Y-%m') ASC`
      ).catch(() => []),
      query<{
        year_month: string;
        total_gastos: number;
      }>(
        `SELECT 
           DATE_FORMAT(g.fecha, '%Y-%m') AS year_month,
           COALESCE(SUM(g.monto), 0) AS total_gastos
         FROM gastos g
         WHERE g.activo = 1
         GROUP BY DATE_FORMAT(g.fecha, '%Y-%m')
         ORDER BY DATE_FORMAT(g.fecha, '%Y-%m') ASC`
      ).catch(() => []),
    ]);

    const purchaseMap = new Map<string, number>();
    (monthlyPurchaseRows ?? []).forEach((r) => {
      purchaseMap.set(String(r.year_month), Number(r.total_compras) || 0);
    });

    const expenseMap = new Map<string, number>();
    (monthlyExpenseRows ?? []).forEach((r) => {
      expenseMap.set(String(r.year_month), Number(r.total_gastos) || 0);
    });

    const monthlyBreakdown: MonthlySalesBreakdown[] = (monthlyRows ?? []).map((r) => {
      const ventas = Number(r.total_ventas) || 0;
      const costo = Number(r.total_costo) || 0;
      const utilidad = Number(r.utilidad) || Math.max(0, Number((ventas - costo).toFixed(2)));
      const ym = String(r.year_month || "2026-06");
      const [y, m] = ym.split("-");
      const label = `${MONTH_NAMES[m] || m} ${y || "2026"}`;
      const totalCompras = purchaseMap.get(ym) || 0;
      const comisionAsesores = Number(r.comision_asesor) || Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number(r.comision_local) || Number((utilidad * 0.40).toFixed(2));
      const gastosMes = Number(expenseMap.get(ym) || 0);
      const saldoComisionLocal = Number((comisionLocal - gastosMes).toFixed(2));

      return {
        year_month: ym,
        label,
        unidades: Number(r.unidades) || 0,
        total_ventas: ventas,
        total_costo: costo,
        total_compras: totalCompras,
        utilidad,
        comision_asesores: comisionAsesores,
        comision_local: comisionLocal,
        gastos: gastosMes,
        saldo_comision_local: saldoComisionLocal,
      };
    });

    // 5. Desglose por Tipo de Producto
    const typeRowsQuery = await query<{
      tipo_nombre: string;
      cat_nombre: string;
      unidades: number;
      total_ventas: number;
      total_costo: number;
      utilidad: number;
    }>(
      `SELECT 
         COALESCE(tp.nombre, 'General') AS tipo_nombre,
         COALESCE(cat.nombre, 'General') AS cat_nombre,
         COALESCE(SUM(d.cantidad), 0) AS unidades,
         COALESCE(SUM(d.total), 0) AS total_ventas,
         COALESCE(SUM(
           COALESCE(
             NULLIF(d.costo_unitario, 0),
             NULLIF(vp.costo_unitario, 0),
             (
               SELECT ROUND(dc.total / dc.cantidad, 2) 
               FROM detalle_compras dc 
               JOIN compras comp ON comp.id_compra = dc.id_compra 
               WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
               LIMIT 1
             ),
             ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
           ) * d.cantidad
         ), 0) AS total_costo,
         GREATEST(0, COALESCE(SUM(d.total), 0) - COALESCE(SUM(
           COALESCE(
             NULLIF(d.costo_unitario, 0),
             NULLIF(vp.costo_unitario, 0),
             (
               SELECT ROUND(dc.total / dc.cantidad, 2) 
               FROM detalle_compras dc 
               JOIN compras comp ON comp.id_compra = dc.id_compra 
               WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
               LIMIT 1
             ),
             ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
           ) * d.cantidad
         ), 0)) AS utilidad
       FROM detalle_ventas d
       JOIN ventas v ON v.id_venta = d.id_venta
       LEFT JOIN variantes_producto vp ON vp.id_variante = d.id_variante
       LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
       LEFT JOIN tipos_producto tp ON tp.id_tipo = prod.id_tipo
       LEFT JOIN categorias cat ON cat.id_categoria = prod.id_categoria
       WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
       ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
       GROUP BY COALESCE(tp.nombre, 'General'), COALESCE(cat.nombre, 'General')
       ORDER BY total_ventas DESC`,
      params
    ).catch(() => []);

    const typeBreakdown: ProductTypeSalesBreakdown[] = (typeRowsQuery ?? []).map((r) => {
      const ventas = Number(r.total_ventas) || 0;
      const costo = Number(r.total_costo) || 0;
      const utilidad = Number(r.utilidad) || Math.max(0, Number((ventas - costo).toFixed(2)));
      const margen = ventas > 0 ? Number(((utilidad / ventas) * 100).toFixed(1)) : 0;

      return {
        tipo: r.tipo_nombre,
        categoria: r.cat_nombre,
        unidades: Number(r.unidades) || 0,
        total_ventas: ventas,
        total_costo: costo,
        utilidad,
        margen_porcentaje: margen,
      };
    });

    // 6. Liquidación por Asesor calculada exactamente por venta unitaria (60% y 40%)
    const advWhereClauses: string[] = [];
    const advParams: unknown[] = [];
    if (selectedYear) {
      advWhereClauses.push(`DATE_FORMAT(v.fecha, '%Y') = ?`);
      advParams.push(selectedYear);
    }
    if (selectedMonth) {
      advWhereClauses.push(`DATE_FORMAT(v.fecha, '%m') = ?`);
      advParams.push(selectedMonth.padStart(2, "0"));
    }
    if (selectedTipoId && Number(selectedTipoId) > 0) {
      advWhereClauses.push(`prod.id_tipo = ?`);
      advParams.push(Number(selectedTipoId));
    }

    const advisorSql = `
      SELECT 
        u.id_usuario,
        u.nombres,
        u.apellidos,
        u.cedula,
        u.correo,
        COALESCE(SUM(s.unidades), 0) AS unidades,
        COALESCE(SUM(s.venta_total), 0) AS total_ventas,
        COALESCE(SUM(s.costo_total), 0) AS total_costo,
        COALESCE(SUM(s.utilidad), 0) AS total_utilidad,
        COALESCE(SUM(s.comision_asesor), 0) AS comision_asesor,
        COALESCE(SUM(s.comision_local), 0) AS comision_local,
        (
          SELECT COALESCE(SUM(pc.monto), 0)
          FROM pagos_comisiones pc
          WHERE pc.id_usuario = u.id_usuario AND pc.activo = 1
        ) AS total_abonos
      FROM usuarios u
      LEFT JOIN (
        SELECT 
          v.id_usuario,
          v.id_venta,
          v.fecha,
          v.total AS venta_total,
          COALESCE(SUM(d.cantidad), 1) AS unidades,
          COALESCE(SUM(
            COALESCE(
              NULLIF(d.costo_unitario, 0),
              NULLIF(vp.costo_unitario, 0),
              (
                SELECT ROUND(dc.total / dc.cantidad, 2) 
                FROM detalle_compras dc 
                JOIN compras comp ON comp.id_compra = dc.id_compra 
                WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                LIMIT 1
              ),
              ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
            ) * d.cantidad
          ), 0) AS costo_total,
          GREATEST(0, v.total - COALESCE(SUM(
            COALESCE(
              NULLIF(d.costo_unitario, 0),
              NULLIF(vp.costo_unitario, 0),
              (
                SELECT ROUND(dc.total / dc.cantidad, 2) 
                FROM detalle_compras dc 
                JOIN compras comp ON comp.id_compra = dc.id_compra 
                WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                LIMIT 1
              ),
              ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
            ) * d.cantidad
          ), 0)) AS utilidad,
          ROUND(GREATEST(0, v.total - COALESCE(SUM(
            COALESCE(
              NULLIF(d.costo_unitario, 0),
              NULLIF(vp.costo_unitario, 0),
              (
                SELECT ROUND(dc.total / dc.cantidad, 2) 
                FROM detalle_compras dc 
                JOIN compras comp ON comp.id_compra = dc.id_compra 
                WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                LIMIT 1
              ),
              ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
            ) * d.cantidad
          ), 0)) * 0.60, 2) AS comision_asesor,
          ROUND(GREATEST(0, v.total - COALESCE(SUM(
            COALESCE(
              NULLIF(d.costo_unitario, 0),
              NULLIF(vp.costo_unitario, 0),
              (
                SELECT ROUND(dc.total / dc.cantidad, 2) 
                FROM detalle_compras dc 
                JOIN compras comp ON comp.id_compra = dc.id_compra 
                WHERE dc.id_variante = d.id_variante AND UPPER(COALESCE(comp.estado, '')) NOT IN ('ANULADA', 'ANULADO')
                ORDER BY comp.fecha DESC, dc.id_detalle_compra DESC 
                LIMIT 1
              ),
              ROUND(COALESCE(d.precio_unitario, vp.precio_venta, 0) * 0.60, 2)
            ) * d.cantidad
          ), 0)) * 0.40, 2) AS comision_local
        FROM ventas v
        LEFT JOIN detalle_ventas d ON d.id_venta = v.id_venta
        LEFT JOIN variantes_producto vp ON vp.id_variante = d.id_variante
        LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
        WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        ${advWhereClauses.length ? `AND ${advWhereClauses.join(" AND ")}` : ""}
        GROUP BY v.id_venta
      ) s ON s.id_usuario = u.id_usuario
      WHERE u.activo = 1 AND (u.id_perfil IN (2, 3, 4) OR u.id_usuario IN (SELECT DISTINCT id_usuario FROM ventas)) AND u.nombres NOT LIKE '%Iralda%' AND u.apellidos NOT LIKE '%Manos%'
      GROUP BY u.id_usuario
      ORDER BY total_ventas DESC, u.nombres ASC
    `;

    const advisorRows = await query<{
      id_usuario: number;
      nombres: string;
      apellidos: string;
      cedula: string;
      correo: string;
      unidades: number;
      total_ventas: number;
      total_costo: number;
      total_utilidad: number;
      comision_asesor: number;
      comision_local: number;
      total_abonos: number;
    }>(advisorSql, advParams).catch(() => []);

    let pagadoTotal = 0;
    let pendienteTotal = 0;

    const advisors: AdvisorReportItem[] = (advisorRows ?? []).map((r) => {
      const ventas = Number(r.total_ventas) || 0;
      const costo = Number(r.total_costo) || 0;
      const utilidad = Number(r.total_utilidad) || Math.max(0, Number((ventas - costo).toFixed(2)));
      const comisionAsesor = Number(r.comision_asesor) || Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number(r.comision_local) || Number((utilidad * 0.40).toFixed(2));

      const abonosRegistrados = Number(r.total_abonos) || 0;
      const pagado = abonosRegistrados;
      const pendiente = Math.max(0, comisionAsesor - abonosRegistrados);

      pagadoTotal += pagado;
      pendienteTotal += pendiente;

      let estadoPago: "PAGADO" | "PENDIENTE" | "SIN_COMISION" = "SIN_COMISION";
      if (comisionAsesor > 0) {
        if (pendiente <= 0) {
          estadoPago = "PAGADO";
        } else {
          estadoPago = "PENDIENTE";
        }
      }

      return {
        id_usuario: Number(r.id_usuario),
        asesor: `${r.nombres} ${r.apellidos}`.trim(),
        cedula: r.cedula,
        correo: r.correo,
        total_ventas: ventas,
        total_costo: costo,
        total_utilidad: utilidad,
        comision_asesor: comisionAsesor,
        comision_local: comisionLocal,
        unidades_vendidas: Number(r.unidades) || 0,
        comision_pagada: pagado,
        saldo_pendiente: pendiente,
        estado_pago: estadoPago,
      };
    });

    // 7. Gastos con filtro de fecha
    const filterMonthParam = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth.padStart(2, "0")}` : undefined;
    const { summary: expSummary } = await listExpenses({
      year: selectedYear || undefined,
      month: filterMonthParam,
    }).catch(() => ({
      summary: {
        total: 0,
        fijo: 0,
        variable: 0,
        marketing: 0,
        operativo: 0,
        mejoras: 0,
        count: 0,
        totalVentas: 0,
        utilidadBruta: 0,
        comisionLocal40: 0,
        saldoComisionLocal: 0,
      },
      expenses: [],
    }));

    // Calcular KPIs priorizando la fuente con datos
    const totalVentas =
      monthlyBreakdown.reduce((sum, m) => sum + m.total_ventas, 0) ||
      typeBreakdown.reduce((sum, t) => sum + t.total_ventas, 0) ||
      advisors.reduce((sum, a) => sum + a.total_ventas, 0);

    const totalCostos =
      monthlyBreakdown.reduce((sum, m) => sum + m.total_costo, 0) ||
      typeBreakdown.reduce((sum, t) => sum + t.total_costo, 0) ||
      advisors.reduce((sum, a) => sum + a.total_costo, 0);

    const utilidadBruta =
      monthlyBreakdown.reduce((sum, m) => sum + m.utilidad, 0) ||
      typeBreakdown.reduce((sum, t) => sum + t.utilidad, 0) ||
      advisors.reduce((sum, a) => sum + a.total_utilidad, 0);

    const totalUnidades =
      monthlyBreakdown.reduce((sum, m) => sum + m.unidades, 0) ||
      typeBreakdown.reduce((sum, t) => sum + t.unidades, 0) ||
      advisors.reduce((sum, a) => sum + a.unidades_vendidas, 0);

    const comisionesAsesores = Number((utilidadBruta * 0.60).toFixed(2));
    const comisionesLocal = Number((utilidadBruta * 0.40).toFixed(2));
    const totalGastos = expSummary?.total || 0;
    const utilidadNetaReal = utilidadBruta - totalGastos;
    const saldoComisionLocal = Number((comisionesLocal - totalGastos).toFixed(2));

    return {
      filters: {
        year: selectedYear,
        month: selectedMonth,
        tipoId: selectedTipoId,
      },
      availableYears,
      availableTypes,
      kpis: {
        totalVentas,
        totalCostos,
        utilidadBruta,
        gastosOperativos: totalGastos,
        utilidadNetaReal,
        totalUnidades,
        comisionesAsesores,
        comisionesLocal,
        saldoComisionLocal,
        comisionesPagadas: pagadoTotal,
        comisionesPendientes: pendienteTotal,
      },
      monthlyBreakdown,
      typeBreakdown,
      advisors,
    };
  } catch (error) {
    console.error("getFinancialReport ERROR:", error);
    return {
      filters: { year: selectedYear, month: selectedMonth, tipoId: selectedTipoId },
      availableYears: [],
      availableTypes: [],
      kpis: {
        totalVentas: 0,
        totalCostos: 0,
        utilidadBruta: 0,
        gastosOperativos: 0,
        utilidadNetaReal: 0,
        totalUnidades: 0,
        comisionesAsesores: 0,
        comisionesLocal: 0,
        saldoComisionLocal: 0,
        comisionesPagadas: 0,
        comisionesPendientes: 0,
      },
      monthlyBreakdown: [],
      typeBreakdown: [],
      advisors: [],
    };
  }
}
