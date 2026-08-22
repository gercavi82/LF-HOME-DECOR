import "server-only";

import { createClient } from "@/src/lib/supabase/server";
import { requirePermission } from "@/src/services/auth/authorization";

const ECUADOR_TIME_ZONE = "America/Guayaquil";

type SaleRow = { fecha: string; total: number | string };

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
  const supabase = await createClient();
  const now = new Date();
  const today = localDateParts(now);
  const sevenDaysStart = new Date(
    Date.UTC(today.year, today.month - 1, today.day - 6, 5),
  ).toISOString();

  const [summaryResult, lowStockResult, outOfStockResult, salesResult] =
    await Promise.all([
      supabase.from("vw_dashboard_ventas").select("ventas_hoy, ventas_mes, cantidad_ventas_hoy, cantidad_ventas_mes").maybeSingle(),
      supabase.from("vw_productos_bajo_stock").select("id_stock, producto, codigo_gs1, bodega, stock_actual, stock_minimo, estado_stock", { count: "exact" }).order("stock_actual").limit(5),
      supabase.from("vw_productos_agotados").select("id_stock", { count: "exact", head: true }),
      supabase.from("ventas").select("fecha, total").gte("fecha", sevenDaysStart).neq("estado", "ANULADA").order("fecha"),
    ]);

  const errors = [summaryResult.error, lowStockResult.error, outOfStockResult.error, salesResult.error].filter(Boolean);
  if (errors.length) {
    console.error("SUPABASE dashboard ERROR:", errors.map((error) => ({ code: error?.code, message: error?.message })));
    throw new Error("No fue posible cargar los indicadores del dashboard.");
  }

  const summary = summaryResult.data;
  const alerts: DashboardAlert[] = (lowStockResult.data ?? []).map((item) => ({
    ...item,
    codigo_gs1: item.codigo_gs1 ?? null,
    stock_actual: Number(item.stock_actual) || 0,
    stock_minimo: Number(item.stock_minimo) || 0,
  }));

  return {
    context,
    salesToday: Number(summary?.ventas_hoy) || 0,
    salesMonth: Number(summary?.ventas_mes) || 0,
    salesCountToday: Number(summary?.cantidad_ventas_hoy) || 0,
    salesCountMonth: Number(summary?.cantidad_ventas_mes) || 0,
    lowStockCount: lowStockResult.count ?? alerts.length,
    outOfStockCount: outOfStockResult.count ?? 0,
    alerts,
    lastSevenDays: buildLastSevenDays(now, (salesResult.data ?? []) as SaleRow[]),
  };
}
