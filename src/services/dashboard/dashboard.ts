import "server-only";

import { query, queryOne } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

const ECUADOR_TIME_ZONE = "America/Guayaquil";

type SaleRow = { fecha: string | Date; total: number | string };

export type DashboardAlert = {
  id_stock: number;
  producto: string;
  codigo_gs1: string | null;
  bodega: string;
  stock_actual: number;
  stock_minimo: number;
  estado_stock: string;
};

export type DashboardDay = {
  key: string;
  label: string;
  total: number;
  count: number;
};

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateKey(date: Date) {
  const { year, month, day } = localDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildLastSevenDays(now: Date, sales: SaleRow[]): DashboardDay[] {
  const today = localDateParts(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + index - 6, 5));
    return {
      key: dateKey(date),
      label: new Intl.DateTimeFormat("es-EC", {
        timeZone: ECUADOR_TIME_ZONE,
        weekday: "short",
        day: "2-digit",
      }).format(date).replace(".", ""),
      total: 0,
      count: 0,
    };
  });

  const byDate = new Map(days.map((day) => [day.key, day]));
  for (const sale of sales) {
    const day = byDate.get(dateKey(new Date(sale.fecha)));
    if (day) {
      day.total += Number(sale.total) || 0;
      day.count += 1;
    }
  }
  return days;
}

export async function getDashboardData() {
  const context = await requirePermission("DASHBOARD_VER");
  const now = new Date();
  const today = localDateParts(now);
  const sevenDaysStart = new Date(
    Date.UTC(today.year, today.month - 1, today.day - 6, 5),
  );

  try {
    const [summary, lowStockAlerts, lowStockCountRow, outOfStockRow, recentSales] =
      await Promise.all([
        queryOne<{
          ventas_hoy: number;
          ventas_mes: number;
          cantidad_ventas_hoy: number;
          cantidad_ventas_mes: number;
        }>(
          `SELECT
             COALESCE(SUM(CASE
               WHEN DATE(v.fecha) = CURDATE()
                    AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               THEN v.total ELSE 0 END), 0) AS ventas_hoy,
             COALESCE(SUM(CASE
               WHEN DATE_FORMAT(v.fecha, '%Y-%m-01') = DATE_FORMAT(NOW(), '%Y-%m-01')
                    AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               THEN v.total ELSE 0 END), 0) AS ventas_mes,
             COALESCE(SUM(CASE
               WHEN DATE(v.fecha) = CURDATE()
                    AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               THEN 1 ELSE 0 END), 0) AS cantidad_ventas_hoy,
             COALESCE(SUM(CASE
               WHEN DATE_FORMAT(v.fecha, '%Y-%m-01') = DATE_FORMAT(NOW(), '%Y-%m-01')
                    AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
               THEN 1 ELSE 0 END), 0) AS cantidad_ventas_mes
           FROM ventas v`
        ),
        query<DashboardAlert>(
          `SELECT 
             sp.id_stock,
             p.descripcion AS producto,
             COALESCE(vp.codigo_gs1, vp.codigo_interno, '—') AS codigo_gs1,
             b.nombre AS bodega,
             sp.cantidad AS stock_actual,
             vp.stock_minimo,
             CASE
               WHEN sp.cantidad <= 0 THEN 'AGOTADO'
               WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
               ELSE 'DISPONIBLE'
             END AS estado_stock
           FROM stock_producto sp
           JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
           JOIN productos p ON p.id_producto = vp.id_producto
           JOIN bodegas b ON b.id_bodega = sp.id_bodega
           WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
             AND sp.cantidad > 0 AND sp.cantidad <= vp.stock_minimo
           ORDER BY sp.cantidad ASC 
           LIMIT 5`
        ),
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count 
           FROM stock_producto sp
           JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
           JOIN productos p ON p.id_producto = vp.id_producto
           JOIN bodegas b ON b.id_bodega = sp.id_bodega
           WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
             AND sp.cantidad > 0 AND sp.cantidad <= vp.stock_minimo`
        ),
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count 
           FROM stock_producto sp
           JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
           JOIN productos p ON p.id_producto = vp.id_producto
           JOIN bodegas b ON b.id_bodega = sp.id_bodega
           WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
             AND sp.cantidad <= 0`
        ),
        query<SaleRow>(
          `SELECT fecha, total 
           FROM ventas 
           WHERE fecha >= ? AND UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO') 
           ORDER BY fecha ASC`,
          [sevenDaysStart]
        ),
      ]);

    const alerts: DashboardAlert[] = (lowStockAlerts ?? []).map((item) => ({
      id_stock: Number(item.id_stock),
      producto: item.producto,
      codigo_gs1: item.codigo_gs1 ?? null,
      bodega: item.bodega,
      stock_actual: Number(item.stock_actual) || 0,
      stock_minimo: Number(item.stock_minimo) || 0,
      estado_stock: item.estado_stock,
    }));

    return {
      context,
      salesToday: Number(summary?.ventas_hoy) || 0,
      salesMonth: Number(summary?.ventas_mes) || 0,
      salesCountToday: Number(summary?.cantidad_ventas_hoy) || 0,
      salesCountMonth: Number(summary?.cantidad_ventas_mes) || 0,
      lowStockCount: Number(lowStockCountRow?.count) || alerts.length,
      outOfStockCount: Number(outOfStockRow?.count) || 0,
      alerts,
      lastSevenDays: buildLastSevenDays(now, recentSales ?? []),
    };
  } catch (error) {
    console.error("MySQL dashboard ERROR:", error);
    return {
      context,
      salesToday: 0,
      salesMonth: 0,
      salesCountToday: 0,
      salesCountMonth: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      alerts: [],
      lastSevenDays: buildLastSevenDays(now, []),
    };
  }
}
