import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";
import { listExpenses } from "@/src/services/expenses/expenses";

export type MonthlySalesBreakdown = {
  year_month: string;
  label: string;
  unidades: number;
  total_ventas: number;
  total_costo: number;
  utilidad: number;
  comision_asesores: number;
  comision_local: number;
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
  await requirePermission("REPORTES_VER");

  const selectedYear = filters?.year?.trim() || "";
  const selectedMonth = filters?.month?.trim() || "";
  const selectedTipoId = filters?.tipoId?.trim() || "";

  // 1. Obtener años disponibles de ventas
  const yearRows = await query<{ anio: string }>(
    `SELECT DISTINCT DATE_FORMAT(fecha, '%Y') AS anio FROM ventas ORDER BY anio DESC`
  );
  const availableYears = (yearRows ?? []).map((r) => String(r.anio)).filter(Boolean);

  // 2. Obtener tipos de producto disponibles
  const typeRows = await query<{ id: number; nombre: string }>(
    `SELECT id_tipo AS id, nombre FROM tipos_producto WHERE activo = 1 ORDER BY nombre ASC`
  );
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

  // 4. Desglose Mensual
  const monthlyRows = await query<{
    year_month: string;
    unidades: number;
    total_ventas: number;
  }>(
    `SELECT 
       DATE_FORMAT(v.fecha, '%Y-%m') AS year_month,
       COALESCE(SUM(d.cantidad), 0) AS unidades,
       COALESCE(SUM(d.total), 0) AS total_ventas
     FROM ventas v
     JOIN detalle_ventas d ON d.id_venta = v.id_venta
     JOIN variantes_producto vp ON vp.id_variante = d.id_variante
     JOIN productos prod ON prod.id_producto = vp.id_producto
     ${whereSql}
     GROUP BY year_month
     ORDER BY year_month ASC`,
    params
  );

  const monthlyBreakdown: MonthlySalesBreakdown[] = (monthlyRows ?? []).map((r) => {
    const ventas = Number(r.total_ventas) || 0;
    const utilidad = Number((ventas * 0.327).toFixed(2));
    const costo = Number((ventas - utilidad).toFixed(2));
    const ym = String(r.year_month);
    const [y, m] = ym.split("-");
    const label = `${MONTH_NAMES[m] || m} ${y}`;

    return {
      year_month: ym,
      label,
      unidades: Number(r.unidades) || 0,
      total_ventas: ventas,
      total_costo: costo,
      utilidad,
      comision_asesores: Number((utilidad * 0.60).toFixed(2)),
      comision_local: Number((utilidad * 0.40).toFixed(2)),
    };
  });

  // 5. Desglose por Tipo de Producto
  const typeRowsQuery = await query<{
    tipo_nombre: string;
    cat_nombre: string;
    unidades: number;
    total_ventas: number;
  }>(
    `SELECT 
       COALESCE(tp.nombre, 'General') AS tipo_nombre,
       COALESCE(cat.nombre, 'General') AS cat_nombre,
       COALESCE(SUM(d.cantidad), 0) AS unidades,
       COALESCE(SUM(d.total), 0) AS total_ventas
     FROM ventas v
     JOIN detalle_ventas d ON d.id_venta = v.id_venta
     JOIN variantes_producto vp ON vp.id_variante = d.id_variante
     JOIN productos prod ON prod.id_producto = vp.id_producto
     LEFT JOIN tipos_producto tp ON tp.id_tipo = prod.id_tipo
     LEFT JOIN categorias cat ON cat.id_categoria = prod.id_categoria
     ${whereSql}
     GROUP BY prod.id_tipo, tp.nombre, cat.nombre
     ORDER BY total_ventas DESC`,
    params
  );

  const typeBreakdown: ProductTypeSalesBreakdown[] = (typeRowsQuery ?? []).map((r) => {
    const ventas = Number(r.total_ventas) || 0;
    const utilidad = Number((ventas * 0.327).toFixed(2));
    const costo = Number((ventas - utilidad).toFixed(2));
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

  // 6. Liquidación por Asesor con los filtros aplicados
  const advisorRows = await query<{
    id_usuario: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    correo: string;
    unidades: number;
    total_ventas: number;
    observaciones_concat: string | null;
  }>(
    `SELECT 
       u.id_usuario,
       u.nombres,
       u.apellidos,
       u.cedula,
       u.correo,
       COALESCE(SUM(d.cantidad), 0) AS unidades,
       COALESCE(SUM(d.total), 0) AS total_ventas,
       GROUP_CONCAT(v.observaciones SEPARATOR ' || ') AS observaciones_concat
     FROM usuarios u
     LEFT JOIN ventas v ON v.id_usuario = u.id_usuario AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
       ${selectedYear ? `AND DATE_FORMAT(v.fecha, '%Y') = '${selectedYear}'` : ""}
       ${selectedMonth ? `AND DATE_FORMAT(v.fecha, '%m') = '${selectedMonth.padStart(2, "0")}'` : ""}
     LEFT JOIN detalle_ventas d ON d.id_venta = v.id_venta
     LEFT JOIN variantes_producto vp ON vp.id_variante = d.id_variante
     LEFT JOIN productos prod ON prod.id_producto = vp.id_producto
       ${selectedTipoId ? `AND prod.id_tipo = ${Number(selectedTipoId)}` : ""}
     WHERE u.activo = 1 AND u.id_perfil IN (2, 3)
     GROUP BY u.id_usuario
     ORDER BY total_ventas DESC, u.nombres ASC`
  );

  let pagadoTotal = 0;
  let pendienteTotal = 0;

  const advisors: AdvisorReportItem[] = (advisorRows ?? []).map((r) => {
    const ventas = Number(r.total_ventas) || 0;
    const utilidad = Number((ventas * 0.327).toFixed(2));
    const costo = Number((ventas - utilidad).toFixed(2));
    const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
    const comisionLocal = Number((utilidad * 0.40).toFixed(2));

    const obs = r.observaciones_concat || "";
    const isPaid = obs.includes("[PAGADA]") && !obs.includes("[PENDIENTE]");
    const pagado = isPaid ? comisionAsesor : 0;
    const pendiente = Math.max(0, comisionAsesor - pagado);

    pagadoTotal += pagado;
    pendienteTotal += pendiente;

    let estadoPago: "PAGADO" | "PENDIENTE" | "SIN_COMISION" = "SIN_COMISION";
    if (comisionAsesor > 0) {
      estadoPago = pendiente <= 0 ? "PAGADO" : "PENDIENTE";
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
      estado_pago: estadoPago,
    };
  });

  // 7. Gastos con filtro de fecha
  const filterMonthParam = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth.padStart(2, "0")}` : undefined;
  const { summary: expSummary } = await listExpenses({ month: filterMonthParam });

  const totalVentas = monthlyBreakdown.reduce((sum, m) => sum + m.total_ventas, 0);
  const totalCostos = monthlyBreakdown.reduce((sum, m) => sum + m.total_costo, 0);
  const utilidadBruta = monthlyBreakdown.reduce((sum, m) => sum + m.utilidad, 0);
  const totalUnidades = monthlyBreakdown.reduce((sum, m) => sum + m.unidades, 0);
  const comisionesAsesores = monthlyBreakdown.reduce((sum, m) => sum + m.comision_asesores, 0);
  const comisionesLocal = monthlyBreakdown.reduce((sum, m) => sum + m.comision_local, 0);
  const totalGastos = expSummary.total;
  const utilidadNetaReal = utilidadBruta - totalGastos;

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
      comisionesPagadas: pagadoTotal,
      comisionesPendientes: pendienteTotal,
    },
    monthlyBreakdown,
    typeBreakdown,
    advisors,
  };
}
