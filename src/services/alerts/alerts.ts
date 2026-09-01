import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requireAnyPermission } from "@/src/services/auth/authorization";

export type AlertType =
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "OVERDUE_PAYMENT"
  | "UPCOMING_PAYMENT"
  | "EXPENSE_PENDING";

export type AlertItem = {
  id: string;
  category: "INVENTARIO" | "PAGOS" | "GASTOS";
  title: string;
  subtitle: string;
  detail: string;
  badgeLabel: string;
  severity: "danger" | "warning" | "info";
  href: string;
  actionLabel: string;
  type: AlertType;
  valuePrimary?: string | number;
  valueSecondary?: string | number;
};

export type AlertsSummary = {
  total: number;
  out: number;
  low: number;
  overdue: number;
  upcoming: number;
  expenses: number;
};

async function queryAllAlerts(): Promise<AlertItem[]> {
  const alerts: AlertItem[] = [];

  try {
    // 1. Alertas de Inventario (Agotados y Stock Mínimo)
    const stockRows = await query<{
      id_stock: number;
      id_producto: number;
      producto: string;
      codigo_gs1: string;
      bodega: string;
      stock_actual: number;
      stock_minimo: number;
      estado_stock: string;
    }>(
      `SELECT 
         sp.id_stock,
         p.id_producto,
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
         AND (sp.cantidad <= 0 OR sp.cantidad <= vp.stock_minimo)
       ORDER BY sp.cantidad ASC, p.descripcion ASC
       LIMIT 100`
    ).catch(() => []);

    for (const r of stockRows ?? []) {
      const isOut = Number(r.stock_actual) <= 0;
      alerts.push({
        id: `stock-${r.id_stock}`,
        category: "INVENTARIO",
        title: r.producto,
        subtitle: `${r.bodega} · Código: ${r.codigo_gs1}`,
        detail: isOut
          ? `Sin existencias disponibles en bodega.`
          : `Quedan ${r.stock_actual} unidades (mínimo recomendado: ${r.stock_minimo}).`,
        badgeLabel: isOut ? "Agotado" : "Stock mínimo",
        severity: isOut ? "danger" : "warning",
        href: `/productos/${r.id_producto}`,
        actionLabel: "Ver producto",
        type: isOut ? "OUT_OF_STOCK" : "LOW_STOCK",
        valuePrimary: `${r.stock_actual} uds`,
        valueSecondary: `Mín: ${r.stock_minimo}`,
      });
    }

    // 2. Alertas de Pagos a Proveedores (Compras con saldo pendiente)
    // 2.1 Alerta Global: Costo Total de Compras vs Pagos Realizados (Diferencia > $500)
    const globalPurchaseTotals = await query<{ total_compras: number; total_abonos: number }>(
      `SELECT 
         COALESCE(SUM(c.total), 0) AS total_compras,
         (
           SELECT COALESCE(SUM(pc.monto), 0) 
           FROM pagos_compras pc 
           WHERE pc.activo = 1
         ) AS total_abonos
       FROM compras c
       WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')`
    ).catch(() => []);

    if (globalPurchaseTotals && globalPurchaseTotals.length > 0) {
      const totCompras = Number(globalPurchaseTotals[0].total_compras) || 0;
      const totAbonos = Number(globalPurchaseTotals[0].total_abonos) || 0;
      const diffGlobal = Math.max(0, Number((totCompras - totAbonos).toFixed(2)));

      if (diffGlobal >= 500) {
        alerts.unshift({
          id: "pago-diferencia-global-500",
          category: "PAGOS",
          title: "Alerta: Saldo pendiente a proveedores es mayor o igual a $500.00",
          subtitle: "Costo Total Compras − Total Pagos Realizados",
          detail: `Costo total compras: $${totCompras.toFixed(2)} − Pagos/Depósitos: $${totAbonos.toFixed(2)} = Saldo pendiente: $${diffGlobal.toFixed(2)} (alcanza o supera el límite de $500.00).`,
          badgeLabel: "Saldo ≥ $500",
          severity: "danger",
          href: "/compras",
          actionLabel: "Ver compras y pagos",
          type: "OVERDUE_PAYMENT",
          valuePrimary: `$${diffGlobal.toFixed(2)}`,
          valueSecondary: "Límite: $500",
        });
      }
    }

    const purchaseRows = await query<{
      id_compra: number;
      numero_compra: string;
      fecha: Date | string;
      total: number;
      proveedor: string;
      dias: number;
      total_abonos: number;
    }>(
      `SELECT 
         c.id_compra,
         COALESCE(c.numero_compra, CONCAT('COM-', c.id_compra)) AS numero_compra,
         c.fecha,
         c.total,
         COALESCE(p.nombre, 'Distribuidora Nacional de Blancos & Edredones') AS proveedor,
         DATEDIFF(NOW(), c.fecha) AS dias,
         COALESCE((
           SELECT SUM(pc.monto) 
           FROM pagos_compras pc 
           WHERE pc.id_compra = c.id_compra AND pc.activo = 1
         ), 0) AS total_abonos
       FROM compras c
       LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
       WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
       ORDER BY c.fecha ASC
       LIMIT 50`
    ).catch(() => []);

    for (const p of purchaseRows ?? []) {
      const total = Number(p.total) || 0;
      const abonos = Number(p.total_abonos) || 0;
      const saldo = Math.max(0, Number((total - abonos).toFixed(2)));
      const dias = Number(p.dias) || 0;

      if (saldo > 0) {
        if (dias >= 30) {
          alerts.push({
            id: `pago-overdue-${p.id_compra}`,
            category: "PAGOS",
            title: `Pago vencido a proveedor: ${p.proveedor}`,
            subtitle: `Factura ${p.numero_compra} · Emitida hace ${dias} días`,
            detail: `Saldo pendiente: $${saldo.toFixed(2)} (Total compra: $${total.toFixed(2)}).`,
            badgeLabel: "Pago vencido",
            severity: "danger",
            href: `/compras`,
            actionLabel: "Registrar abono",
            type: "OVERDUE_PAYMENT",
            valuePrimary: `$${saldo.toFixed(2)}`,
            valueSecondary: `${dias} días`,
          });
        } else if (dias >= 15) {
          alerts.push({
            id: `pago-upcoming-${p.id_compra}`,
            category: "PAGOS",
            title: `Pago próximo a proveedor: ${p.proveedor}`,
            subtitle: `Factura ${p.numero_compra} · ${dias} días de antigüedad`,
            detail: `Saldo por liquidar: $${saldo.toFixed(2)}.`,
            badgeLabel: "Pago próximo",
            severity: "warning",
            href: `/compras`,
            actionLabel: "Ver compra",
            type: "UPCOMING_PAYMENT",
            valuePrimary: `$${saldo.toFixed(2)}`,
            valueSecondary: `${dias} días`,
          });
        }
      }
    }

    // 3. Alertas de Gastos Fijos Mensuales (Si hoy >= día 5 y no hay gastos fijos este mes)
    const currentDay = new Date().getDate();
    if (currentDay >= 5) {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const fixedExpenses = await query<{ count: number }>(
        `SELECT COUNT(*) AS count 
         FROM gastos 
         WHERE categoria = 'FIJO' AND DATE_FORMAT(fecha, '%Y-%m') = ? AND activo = 1`,
        [currentMonth]
      ).catch(() => []);

      const fixedCount = Number(fixedExpenses?.[0]?.count || 0);
      if (fixedCount === 0) {
        alerts.push({
          id: `gasto-fijo-${currentMonth}`,
          category: "GASTOS",
          title: "Gastos fijos del mes pendientes de registro",
          subtitle: `Periodo actual: ${currentMonth}`,
          detail: "Aún no se han registrado gastos fijos de este mes (arriendo, servicios básicos o internet).",
          badgeLabel: "Gasto pendiente",
          severity: "warning",
          href: `/gastos/nuevo`,
          actionLabel: "Registrar gasto",
          type: "EXPENSE_PENDING",
          valuePrimary: "Pendiente",
          valueSecondary: `Día ${currentDay}`,
        });
      }
    }
  } catch (error) {
    console.error("queryAllAlerts error:", error);
  }

  return alerts;
}

export async function getAlertCount(): Promise<number> {
  try {
    const alerts = await queryAllAlerts();
    return alerts.length;
  } catch {
    return 0;
  }
}

export async function getAlerts(requestedType = "") {
  await requireAnyPermission(["INVENTARIO_VER", "DASHBOARD_VER", "FINANZAS_VER", "COMPRA_VER"]);

  try {
    const allAlerts = await queryAllAlerts();

    const filtered = requestedType
      ? allAlerts.filter((a) => {
          if (requestedType === "agotado") return a.type === "OUT_OF_STOCK";
          if (requestedType === "minimo") return a.type === "LOW_STOCK";
          if (requestedType === "vencidos") return a.type === "OVERDUE_PAYMENT";
          if (requestedType === "proximos") return a.type === "UPCOMING_PAYMENT";
          if (requestedType === "gastos") return a.type === "EXPENSE_PENDING";
          if (requestedType === "inventario") return a.category === "INVENTARIO";
          if (requestedType === "pagos") return a.category === "PAGOS" || a.category === "GASTOS";
          return true;
        })
      : allAlerts;

    const summary: AlertsSummary = {
      total: allAlerts.length,
      out: allAlerts.filter((a) => a.type === "OUT_OF_STOCK").length,
      low: allAlerts.filter((a) => a.type === "LOW_STOCK").length,
      overdue: allAlerts.filter((a) => a.type === "OVERDUE_PAYMENT").length,
      upcoming: allAlerts.filter((a) => a.type === "UPCOMING_PAYMENT").length,
      expenses: allAlerts.filter((a) => a.type === "EXPENSE_PENDING").length,
    };

    return {
      alerts: filtered,
      type: requestedType,
      summary,
    };
  } catch (error) {
    console.error("getAlerts error:", error);
    return {
      alerts: [],
      type: "",
      summary: { total: 0, out: 0, low: 0, overdue: 0, upcoming: 0, expenses: 0 },
    };
  }
}

