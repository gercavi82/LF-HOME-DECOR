import { Receipt } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { getFinancialReport } from "@/src/services/reports/reports";
import { listCommissionPayments } from "@/src/services/commissions/commissions";
import { CommissionPaymentModal } from "@/src/components/commissions/payment-modal";
import { ReportsView } from "@/src/components/reports/reports-view";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; tipo?: string }>;
}) {
  const { anio = "", mes = "", tipo = "" } = await searchParams;

  const [data, commissionPayments] = await Promise.all([
    getFinancialReport({
      year: anio,
      month: mes,
      tipoId: tipo,
    }),
    listCommissionPayments(),
  ]);

  const advisorOptions = data.advisors.map((a) => ({
    id_usuario: a.id_usuario,
    asesor: a.asesor,
    saldo_pendiente: Math.max(0, a.comision_asesor - a.comision_pagada),
  }));

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Consolidado financiero"
        title="Reportes y comisiones"
        description="Liquidación de comisiones segregada por pestañas: Asesores (60%), Local (40%) y Gastos, Evolución Mensual y Ventas por Producto."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CommissionPaymentModal advisors={advisorOptions} />
            <Link
              href="/gastos"
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold text-lf-navy"
            >
              <Receipt size={17} /> Ver gastos
            </Link>
          </div>
        }
      />

      <ReportsView
        data={data}
        commissionPayments={commissionPayments}
        filters={{ anio, mes, tipo }}
      />
    </ContentContainer>
  );
}
