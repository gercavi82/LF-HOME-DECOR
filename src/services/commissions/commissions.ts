import "server-only";

import { query, execute } from "@/src/lib/db/mysql";
import { requireAnyPermission, requirePermission } from "@/src/services/auth/authorization";
import { commissionPaymentSchema, type CommissionPaymentInput } from "@/src/lib/validation/commissions";
import { ensureCustomTables } from "@/src/lib/db/ensure-tables";

export type CommissionPayment = {
  id_pago_comision: number;
  id_usuario: number;
  asesor: string;
  fecha: string;
  monto: number;
  forma_pago: string;
  referencia: string | null;
  observaciones: string | null;
  registrador: string;
};

export type AdvisorCommissionSummary = {
  id_usuario: number;
  asesor: string;
  cedula: string;
  correo: string;
  total_ventas: number;
  total_costo: number;
  total_utilidad: number;
  comision_asesor: number; // 60%
  comision_local: number;  // 40%
  unidades_vendidas: number;
  comision_pagada: number;
  saldo_pendiente: number;
  estado_pago: "PAGADO" | "ABONO_PARCIAL" | "PENDIENTE" | "SIN_COMISION";
};

type CommissionRowRaw = {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  total_ventas: number;
  total_subtotal: number;
  unidades: number;
  total_abonos: number;
};

export async function getCommissionsSummary(month?: string): Promise<{
  advisors: AdvisorCommissionSummary[];
  totals: {
    ventas: number;
    costos: number;
    utilidad: number;
    comision_asesor: number;
    comision_local: number;
    unidades: number;
    pagado: number;
    pendiente: number;
  };
}> {
  await requireAnyPermission(["COMISIONES_VER", "REPORTES_VER", "FINANZAS_VER", "DASHBOARD_VER"]);
  await ensureCustomTables().catch(() => null);

  let sql = `
    SELECT 
      u.id_usuario,
      u.nombres,
      u.apellidos,
      u.cedula,
      u.correo,
      COALESCE(SUM(d.total), 0) AS total_ventas,
      COALESCE(SUM(d.subtotal), 0) AS total_subtotal,
      COALESCE(SUM(d.cantidad), 0) AS unidades,
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
          ROUND(d.precio_unitario * 0.60, 2)
        ) * d.cantidad
      ), 0) AS total_costo,
      (
        SELECT COALESCE(SUM(pc.monto), 0)
        FROM pagos_comisiones pc
        WHERE pc.id_usuario = u.id_usuario AND pc.activo = 1
      ) AS total_abonos
    FROM usuarios u
    LEFT JOIN ventas v ON v.id_usuario = u.id_usuario AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
  `;

  const params: unknown[] = [];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    sql += ` AND DATE_FORMAT(v.fecha, '%Y-%m') = ?`;
    params.push(month);
  }

  sql += `
    LEFT JOIN detalle_ventas d ON d.id_venta = v.id_venta
    LEFT JOIN variantes_producto vp ON vp.id_variante = d.id_variante
    WHERE u.activo = 1 AND u.id_perfil IN (2, 3) AND u.nombres NOT LIKE '%Iralda%' AND u.apellidos NOT LIKE '%Manos%'
    GROUP BY u.id_usuario
    ORDER BY total_ventas DESC, u.nombres ASC
  `;

  try {
    const rows = await query<CommissionRowRaw & { total_costo?: number }>(sql, params).catch(() => []);

    const advisors: AdvisorCommissionSummary[] = (rows ?? []).map((r) => {
      const ventas = Number(r.total_ventas) || 0;
      const costo = Number(r.total_costo) || 0;
      const utilidad = Math.max(0, Number((ventas - costo).toFixed(2)));
      const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number((utilidad * 0.40).toFixed(2));
      const unidades = Number(r.unidades) || 0;

      // Abonos y pagos reales registrados
      const abonosRegistrados = Number(r.total_abonos) || 0;
      const pendiente = Math.max(0, comisionAsesor - abonosRegistrados);

      let estadoPago: "PAGADO" | "ABONO_PARCIAL" | "PENDIENTE" | "SIN_COMISION" = "SIN_COMISION";
      if (comisionAsesor > 0) {
        if (pendiente <= 0) {
          estadoPago = "PAGADO";
        } else if (abonosRegistrados > 0) {
          estadoPago = "ABONO_PARCIAL";
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
        unidades_vendidas: unidades,
        comision_pagada: abonosRegistrados,
        saldo_pendiente: pendiente,
        estado_pago: estadoPago,
      };
    });

    const totals = {
      ventas: advisors.reduce((sum, a) => sum + a.total_ventas, 0),
      costos: advisors.reduce((sum, a) => sum + a.total_costo, 0),
      utilidad: advisors.reduce((sum, a) => sum + a.total_utilidad, 0),
      comision_asesor: advisors.reduce((sum, a) => sum + a.comision_asesor, 0),
      comision_local: advisors.reduce((sum, a) => sum + a.comision_local, 0),
      unidades: advisors.reduce((sum, a) => sum + a.unidades_vendidas, 0),
      pagado: advisors.reduce((sum, a) => sum + a.comision_pagada, 0),
      pendiente: advisors.reduce((sum, a) => sum + a.saldo_pendiente, 0),
    };

    return { advisors, totals };
  } catch (error) {
    console.error("getCommissionsSummary ERROR:", error);
    return {
      advisors: [],
      totals: { ventas: 0, costos: 0, utilidad: 0, comision_asesor: 0, comision_local: 0, unidades: 0, pagado: 0, pendiente: 0 },
    };
  }
}

export async function listCommissionPayments(advisorId?: number): Promise<CommissionPayment[]> {
  await requireAnyPermission(["COMISIONES_VER", "REPORTES_VER", "FINANZAS_VER", "DASHBOARD_VER"]);

  let sql = `
    SELECT 
      pc.id_pago_comision,
      pc.id_usuario,
      CONCAT(u.nombres, ' ', u.apellidos) AS asesor,
      pc.fecha,
      pc.monto,
      pc.forma_pago,
      pc.referencia,
      pc.observaciones,
      CONCAT(reg.nombres, ' ', reg.apellidos) AS registrador
    FROM pagos_comisiones pc
    JOIN usuarios u ON u.id_usuario = pc.id_usuario
    LEFT JOIN usuarios reg ON reg.id_usuario = pc.registrado_por
    WHERE pc.activo = 1
  `;

  const params: unknown[] = [];
  if (advisorId && advisorId > 0) {
    sql += ` AND pc.id_usuario = ?`;
    params.push(advisorId);
  }

  sql += ` ORDER BY pc.fecha DESC, pc.id_pago_comision DESC LIMIT 100`;

  try {
    const rows = await query<{
      id_pago_comision: number;
      id_usuario: number;
      asesor: string;
      fecha: Date | string;
      monto: number;
      forma_pago: string;
      referencia: string | null;
      observaciones: string | null;
      registrador: string | null;
    }>(sql, params).catch(() => []);

    return (rows ?? []).map((r) => ({
      id_pago_comision: Number(r.id_pago_comision),
      id_usuario: Number(r.id_usuario),
      asesor: r.asesor,
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10),
      monto: Number(r.monto) || 0,
      forma_pago: r.forma_pago || "Transferencia",
      referencia: r.referencia ?? null,
      observaciones: r.observaciones ?? null,
      registrador: r.registrador || "Administración",
    }));
  } catch (error) {
    console.error("listCommissionPayments ERROR:", error);
    return [];
  }
}

export async function registerCommissionPayment(input: CommissionPaymentInput) {
  const context = await requirePermission("COMISIONES_PAGAR");
  const parsed = commissionPaymentSchema.parse(input);

  // Asegurar tabla pagos_comisiones
  await execute(`
    CREATE TABLE IF NOT EXISTS \`pagos_comisiones\` (
      \`id_pago_comision\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`id_usuario\` BIGINT NOT NULL,
      \`fecha\` DATE NOT NULL,
      \`monto\` DECIMAL(12,2) NOT NULL,
      \`forma_pago\` VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
      \`referencia\` VARCHAR(100) NULL,
      \`observaciones\` TEXT NULL,
      \`registrado_por\` BIGINT NULL,
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_pagos_comisiones_fecha\` (\`fecha\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `).catch(() => null);

  return execute(
    `INSERT INTO pagos_comisiones (id_usuario, fecha, monto, forma_pago, referencia, observaciones, registrado_por, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      parsed.id_usuario,
      parsed.fecha,
      parsed.monto,
      parsed.forma_pago,
      parsed.referencia || null,
      parsed.observaciones || null,
      context.id_usuario,
    ]
  );
}
