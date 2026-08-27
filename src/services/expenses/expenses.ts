import { execute, query } from "@/src/lib/db/mysql";
import { requirePermission, requireAnyPermission } from "@/src/services/auth/authorization";

import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  expenseCategorySchema,
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/src/lib/validation/expenses";

export { EXPENSE_CATEGORIES, type ExpenseCategory, expenseCategorySchema, createExpenseSchema };

export type ExpenseItem = {
  id_gasto: number;
  fecha: string;
  categoria: ExpenseCategory;
  descripcion: string;
  monto: number;
  id_local: number | null;
  id_usuario: number | null;
  beneficiario: string | null;
  observaciones: string | null;
  activo: boolean;
  local_nombre?: string;
  usuario_nombre?: string;
};

export type ExpenseSummary = {
  total: number;
  fijo: number;
  variable: number;
  marketing: number;
  operativo: number;
  mejoras: number;
  count: number;
  totalVentas: number;
  utilidadBruta: number;
  comisionLocal40: number;
  saldoComisionLocal: number;
};

type ExpenseRowRaw = {
  id_gasto: number;
  fecha: Date | string;
  categoria: string;
  descripcion: string;
  monto: number;
  id_local: number | null;
  id_usuario: number | null;
  beneficiario: string | null;
  observaciones: string | null;
  activo: number | boolean;
  local_nombre: string | null;
  usuario_nombre: string | null;
};

export async function listExpenses(filters?: {
  year?: string;
  month?: string; // YYYY-MM
  category?: string;
}): Promise<{ expenses: ExpenseItem[]; summary: ExpenseSummary }> {
  await requireAnyPermission(["GASTOS_VER", "FINANZAS_VER", "DASHBOARD_VER"]).catch(() => null);

  let sql = `
    SELECT 
      g.id_gasto,
      g.fecha,
      g.categoria,
      g.descripcion,
      g.monto,
      g.id_local,
      g.id_usuario,
      g.beneficiario,
      g.observaciones,
      g.activo,
      l.nombre AS local_nombre,
      CONCAT(u.nombres, ' ', u.apellidos) AS usuario_nombre
    FROM gastos g
    LEFT JOIN locales l ON l.id_local = g.id_local
    LEFT JOIN usuarios u ON u.id_usuario = g.id_usuario
    WHERE g.activo = 1
  `;

  const params: unknown[] = [];

  if (filters?.year && /^\d{4}$/.test(filters.year)) {
    sql += ` AND DATE_FORMAT(g.fecha, '%Y') = ?`;
    params.push(filters.year);
  }

  if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    sql += ` AND DATE_FORMAT(g.fecha, '%Y-%m') = ?`;
    params.push(filters.month);
  }

  if (filters?.category && EXPENSE_CATEGORIES.includes(filters.category as ExpenseCategory)) {
    sql += ` AND g.categoria = ?`;
    params.push(filters.category);
  }

  sql += ` ORDER BY g.fecha DESC, g.id_gasto DESC`;

  try {
    const rows = await query<ExpenseRowRaw>(sql, params);

    const expenses: ExpenseItem[] = rows.map((r) => ({
      id_gasto: Number(r.id_gasto),
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
      categoria: expenseCategorySchema.catch("OPERATIVO").parse(r.categoria),
      descripcion: r.descripcion,
      monto: Number(r.monto) || 0,
      id_local: r.id_local ? Number(r.id_local) : null,
      id_usuario: r.id_usuario ? Number(r.id_usuario) : null,
      beneficiario: r.beneficiario ?? null,
      observaciones: r.observaciones ?? null,
      activo: Boolean(r.activo),
      local_nombre: r.local_nombre ?? "Local Matriz",
      usuario_nombre: r.usuario_nombre ?? "Administración",
    }));

    // Calcular ventas y comisión del 40% del local para el período
    let salesSql = `SELECT COALESCE(SUM(total), 0) AS total_ventas FROM ventas WHERE UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO')`;
    const salesParams: unknown[] = [];
    if (filters?.year && /^\d{4}$/.test(filters.year)) {
      salesSql += ` AND DATE_FORMAT(fecha, '%Y') = ?`;
      salesParams.push(filters.year);
    }
    if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      salesSql += ` AND DATE_FORMAT(fecha, '%Y-%m') = ?`;
      salesParams.push(filters.month);
    }
    const salesRows = await query<{ total_ventas: number }>(salesSql, salesParams).catch(() => []);
    const totalVentas = Number(salesRows?.[0]?.total_ventas) || 0;
    const utilidadBruta = Number((totalVentas * 0.327).toFixed(2));
    const comisionLocal40 = Number((utilidadBruta * 0.40).toFixed(2));
    const totalGastos = Number(expenses.reduce((sum, e) => sum + e.monto, 0).toFixed(2));
    const saldoComisionLocal = Number((comisionLocal40 - totalGastos).toFixed(2));

    const summary: ExpenseSummary = {
      total: totalGastos,
      fijo: expenses.filter((e) => e.categoria === "FIJO").reduce((sum, e) => sum + e.monto, 0),
      variable: expenses.filter((e) => e.categoria === "VARIABLE").reduce((sum, e) => sum + e.monto, 0),
      marketing: expenses.filter((e) => e.categoria === "MARKETING").reduce((sum, e) => sum + e.monto, 0),
      operativo: expenses.filter((e) => e.categoria === "OPERATIVO").reduce((sum, e) => sum + e.monto, 0),
      mejoras: expenses.filter((e) => e.categoria === "MEJORAS").reduce((sum, e) => sum + e.monto, 0),
      count: expenses.length,
      totalVentas,
      utilidadBruta,
      comisionLocal40,
      saldoComisionLocal,
    };

    return { expenses, summary };
  } catch (error) {
    console.error("listExpenses ERROR:", error);
    return {
      expenses: [],
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
    };
  }
}

export async function createExpense(data: CreateExpenseInput) {
  const context = await requirePermission("GASTOS_CREAR");
  const parsed = createExpenseSchema.parse(data);

  return execute(
    `INSERT INTO gastos (fecha, categoria, descripcion, monto, id_local, id_usuario, beneficiario, observaciones, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      parsed.fecha,
      parsed.categoria,
      parsed.descripcion,
      parsed.monto,
      context.id_local || 1,
      context.id_usuario,
      parsed.beneficiario || null,
      parsed.observaciones || null,
    ]
  );
}
