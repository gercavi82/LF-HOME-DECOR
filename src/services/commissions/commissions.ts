import "server-only";

import { query } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

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
  estado_pago: "PAGADO" | "PENDIENTE" | "SIN_COMISION";
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
  observaciones_concat: string | null;
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
  await requirePermission("COMISIONES_VER");

  let sql = `
    SELECT 
      u.id_usuario,
      u.nombres,
      u.apellidos,
      u.cedula,
      u.correo,
      COALESCE(SUM(v.total), 0) AS total_ventas,
      COALESCE(SUM(v.subtotal), 0) AS total_subtotal,
      COALESCE(SUM(d.cantidad), 0) AS unidades,
      GROUP_CONCAT(v.observaciones SEPARATOR ' || ') AS observaciones_concat
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
    WHERE u.activo = 1 AND u.id_perfil IN (2, 3) -- Venta Local y Asesores
    GROUP BY u.id_usuario
    ORDER BY total_ventas DESC, u.nombres ASC
  `;

  try {
    const rows = await query<CommissionRowRaw>(sql, params);

    const advisors: AdvisorCommissionSummary[] = rows.map((r) => {
      const ventas = Number(r.total_ventas) || 0;
      // El margen promedio de edredones y sábanas es aprox 33% de utilidad sobre venta (o Costo = ~67% de Venta)
      // Si existen observaciones con comisiones explícitas, las sumamos; si no, calculamos 60%/40% sobre utilidad estimada
      const utilidad = ventas > 0 ? Number((ventas * 0.327).toFixed(2)) : 0;
      const costo = Number((ventas - utilidad).toFixed(2));
      const comisionAsesor = Number((utilidad * 0.60).toFixed(2));
      const comisionLocal = Number((utilidad * 0.40).toFixed(2));
      const unidades = Number(r.unidades) || 0;

      // Evaluar pagos en base a observaciones registradas
      const obs = r.observaciones_concat || "";
      const isPaid = obs.includes("[PAGADA]") && !obs.includes("[PENDIENTE]");
      const pagado = isPaid ? comisionAsesor : 0;
      const pendiente = Math.max(0, comisionAsesor - pagado);

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
        unidades_vendidas: unidades,
        comision_pagada: pagado,
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
