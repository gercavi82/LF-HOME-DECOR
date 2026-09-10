import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getFinancialReport } from "@/src/services/reports/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = (searchParams.get("formato") || "xlsx").toLowerCase();
    const anio = searchParams.get("anio") || "";
    const mes = searchParams.get("mes") || "";
    const tipo = searchParams.get("tipo") || "";

    const data = await getFinancialReport({
      year: anio,
      month: mes,
      tipoId: tipo,
    });

    const { kpis, advisors, monthlyBreakdown, typeBreakdown } = data;

    const todayStr = new Date().toISOString().slice(0, 10);
    const fileNameBase = `reporte_financiero_comisiones_${todayStr}`;

    // 1. FORMATO CSV
    if (formato === "csv") {
      const escapeCsv = (val: unknown) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows: string[][] = [];

      rows.push(["LIQUIDACION DE COMISIONES POR ASESOR (60%)"]);
      rows.push([
        "ID Asesor",
        "Asesor / Vendedor",
        "Cédula / Identificación",
        "Unidades Vendidas",
        "Ventas Totales ($)",
        "Costo Total ($)",
        "Utilidad Generada ($)",
        "Comisión Asesor 60% ($)",
        "Comisión Pagada ($)",
        "Saldo Pendiente ($)",
        "Estado",
      ]);

      advisors.forEach((a) => {
        rows.push([
          String(a.id_usuario),
          escapeCsv(a.asesor),
          escapeCsv(a.cedula || ""),
          String(a.unidades_vendidas),
          a.total_ventas.toFixed(2),
          a.total_costo.toFixed(2),
          a.total_utilidad.toFixed(2),
          a.comision_asesor.toFixed(2),
          a.comision_pagada.toFixed(2),
          a.saldo_pendiente.toFixed(2),
          escapeCsv(a.estado_pago),
        ]);
      });

      rows.push([]);
      rows.push(["EVOLUCION MENSUAL Y BALANCE LOCAL (40%)"]);
      rows.push([
        "Mes / Período",
        "Unidades",
        "Ventas Totales ($)",
        "Costo Mercadería ($)",
        "Utilidad Bruta ($)",
        "Comisión Asesores 60% ($)",
        "Comisión Local 40% ($)",
        "Gastos Operativos ($)",
        "Saldo Neto Local ($)",
      ]);

      monthlyBreakdown.forEach((m) => {
        rows.push([
          escapeCsv(m.label),
          String(m.unidades),
          m.total_ventas.toFixed(2),
          m.total_costo.toFixed(2),
          m.utilidad.toFixed(2),
          m.comision_asesores.toFixed(2),
          m.comision_local.toFixed(2),
          m.gastos.toFixed(2),
          m.saldo_comision_local.toFixed(2),
        ]);
      });

      const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileNameBase}.csv"`,
        },
      });
    }

    // 2. FORMATO XLSX (EXCEL MULTIPESTAÑA)
    if (formato === "xlsx") {
      const summaryRows = [
        { "Indicador": "Ventas Totales ($)", "Valor": Number(kpis.totalVentas.toFixed(2)) },
        { "Indicador": "Costos de Mercadería ($)", "Valor": Number(kpis.totalCostos.toFixed(2)) },
        { "Indicador": "Utilidad Bruta ($)", "Valor": Number(kpis.utilidadBruta.toFixed(2)) },
        { "Indicador": "Gastos Operativos Registrados ($)", "Valor": Number(kpis.gastosOperativos.toFixed(2)) },
        { "Indicador": "Utilidad Neta Real del Negocio ($)", "Valor": Number(kpis.utilidadNetaReal.toFixed(2)) },
        { "Indicador": "Total Unidades Vendidas", "Valor": kpis.totalUnidades },
        { "Indicador": "Total Comisiones Asesores (60%) ($)", "Valor": Number(kpis.comisionesAsesores.toFixed(2)) },
        { "Indicador": "Comisiones Pagadas a Asesores ($)", "Valor": Number(kpis.comisionesPagadas.toFixed(2)) },
        { "Indicador": "Comisiones Pendientes Asesores ($)", "Valor": Number(kpis.comisionesPendientes.toFixed(2)) },
        { "Indicador": "Total Comisión Locales (40%) ($)", "Valor": Number(kpis.comisionesLocal.toFixed(2)) },
        { "Indicador": "Saldo Neto Comisión Locales ($)", "Valor": Number(kpis.saldoComisionLocal.toFixed(2)) },
        { "Indicador": "Fecha de Emisión", "Valor": todayStr },
      ];

      const advisorRows = advisors.map((a) => ({
        "ID Asesor": a.id_usuario,
        "Asesor / Vendedor": a.asesor,
        "Cédula": a.cedula || "",
        "Unidades Vendidas": a.unidades_vendidas,
        "Ventas Totales ($)": Number(a.total_ventas.toFixed(2)),
        "Costo Total ($)": Number(a.total_costo.toFixed(2)),
        "Utilidad Generada ($)": Number(a.total_utilidad.toFixed(2)),
        "Comisión Asesor (60%) ($)": Number(a.comision_asesor.toFixed(2)),
        "Comisión Pagada ($)": Number(a.comision_pagada.toFixed(2)),
        "Saldo Pendiente ($)": Number(a.saldo_pendiente.toFixed(2)),
        "Estado de Pago": a.estado_pago,
      }));

      const monthlyRows = monthlyBreakdown.map((m) => ({
        "Período / Mes": m.label,
        "Unidades": m.unidades,
        "Ventas ($)": Number(m.total_ventas.toFixed(2)),
        "Costos ($)": Number(m.total_costo.toFixed(2)),
        "Utilidad ($)": Number(m.utilidad.toFixed(2)),
        "Com. Asesores (60%) ($)": Number(m.comision_asesores.toFixed(2)),
        "Com. Local (40%) ($)": Number(m.comision_local.toFixed(2)),
        "Gastos Operativos ($)": Number(m.gastos.toFixed(2)),
        "Saldo Neto Local ($)": Number(m.saldo_comision_local.toFixed(2)),
      }));

      const typeRows = typeBreakdown.map((t) => ({
        "Tipo de Producto": t.tipo,
        "Categoría": t.categoria,
        "Unidades": t.unidades,
        "Ventas ($)": Number(t.total_ventas.toFixed(2)),
        "Costo ($)": Number(t.total_costo.toFixed(2)),
        "Utilidad ($)": Number(t.utilidad.toFixed(2)),
        "Margen (%)": Number(t.margen_porcentaje.toFixed(2)),
      }));

      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen Ejecutivo");

      const advisorsSheet = XLSX.utils.json_to_sheet(advisorRows);
      XLSX.utils.book_append_sheet(workbook, advisorsSheet, "Liquidación Asesores (60%)");

      const monthlySheet = XLSX.utils.json_to_sheet(monthlyRows);
      XLSX.utils.book_append_sheet(workbook, monthlySheet, "Evolución Mensual");

      const typeSheet = XLSX.utils.json_to_sheet(typeRows);
      XLSX.utils.book_append_sheet(workbook, typeSheet, "Ventas por Categoría");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileNameBase}.xlsx"`,
        },
      });
    }

    // 3. FORMATO PDF (DISEÑO CORPORATIVO MI HOGAR Y CONFORT)
    if (formato === "pdf") {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      let logoBase64: string | null = null;
      try {
        const logoPath = path.join(process.cwd(), "public", "logo", "mi-hogar-y-confort.png");
        if (fs.existsSync(logoPath)) {
          logoBase64 = fs.readFileSync(logoPath).toString("base64");
        }
      } catch (err) {
        console.error("Error cargando logo para PDF:", err);
      }

      // Encabezado Corporativo
      doc.setFillColor(27, 37, 89); // #1b2559 Brand Navy
      doc.rect(0, 0, pageWidth, 55, "F");

      if (logoBase64) {
        try {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(35, 6, 64, 43, 3, 3, "F");
          doc.addImage(logoBase64, "JPEG", 37, 7.5, 60, 40);
        } catch (imgErr) {
          console.error("Error renderizando imagen de logo en PDF:", imgErr);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("Reporte Financiero y Liquidación de Comisiones", logoBase64 ? 112 : 35, 34);

      const fechaEmision = new Date().toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.setFontSize(9);
      doc.text(`Emisión: ${fechaEmision}`, pageWidth - 35, 34, { align: "right" });

      // Filtros aplicados
      let filtrosTexto = [];
      if (anio) filtrosTexto.push(`Año: ${anio}`);
      if (mes) filtrosTexto.push(`Mes: ${mes}`);
      if (tipo) filtrosTexto.push(`Tipo de Producto: ${tipo}`);

      doc.setTextColor(70, 80, 95);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        filtrosTexto.length ? `Filtros aplicados: ${filtrosTexto.join(" | ")}` : "Filtros aplicados: Consolidado histórico general",
        35,
        74
      );

      // Bloques resumen (KPIs)
      const summaryKpis = [
        { label: "VENTAS TOTALES", val: `$${kpis.totalVentas.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "UTILIDAD BRUTA", val: `$${kpis.utilidadBruta.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "COM. ASESORES (60%)", val: `$${kpis.comisionesAsesores.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "COM. LOCAL (40%)", val: `$${kpis.comisionesLocal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "GASTOS REGISTRADOS", val: `$${kpis.gastosOperativos.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "SALDO NETO LOCAL", val: `$${kpis.saldoComisionLocal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
      ];

      const kpiWidth = (pageWidth - 70 - (summaryKpis.length - 1) * 8) / summaryKpis.length;
      let curX = 35;
      const kpiY = 86;
      const kpiHeight = 40;

      summaryKpis.forEach((kpi) => {
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(220, 226, 235);
        doc.roundedRect(curX, kpiY, kpiWidth, kpiHeight, 4, 4, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(110, 120, 135);
        doc.text(kpi.label, curX + 6, kpiY + 14);

        doc.setFontSize(10.5);
        doc.setTextColor(27, 37, 89);
        doc.text(kpi.val, curX + 6, kpiY + 30);

        curX += kpiWidth + 8;
      });

      // Sección 1: Liquidación de Asesores (60%)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(27, 37, 89);
      doc.text("Liquidación y Comisiones de Asesores Comerciales (60%)", 35, 142);

      const advisorHeaders = [
        "Asesor / Vendedor",
        "Cédula",
        "Unidades",
        "Ventas ($)",
        "Utilidad ($)",
        "Comisión (60%)",
        "Pagado ($)",
        "Saldo Pendiente",
        "Estado",
      ];

      const advisorData = advisors.map((a) => [
        a.asesor,
        a.cedula || "-",
        a.unidades_vendidas,
        `$${a.total_ventas.toFixed(2)}`,
        `$${a.total_utilidad.toFixed(2)}`,
        `$${a.comision_asesor.toFixed(2)}`,
        `$${a.comision_pagada.toFixed(2)}`,
        `$${a.saldo_pendiente.toFixed(2)}`,
        a.estado_pago,
      ]);

      autoTable(doc, {
        startY: 148,
        head: [advisorHeaders],
        body: advisorData,
        theme: "striped",
        headStyles: {
          fillColor: [27, 37, 89],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [45, 55, 72],
        },
        columnStyles: {
          // 0: Asesor automático
          1: { cellWidth: 80 },
          2: { cellWidth: 45, halign: "center" },
          3: { cellWidth: 70, halign: "right" },
          4: { cellWidth: 70, halign: "right" },
          5: { cellWidth: 80, halign: "right", fontStyle: "bold" },
          6: { cellWidth: 70, halign: "right" },
          7: { cellWidth: 80, halign: "right", fontStyle: "bold" },
          8: { cellWidth: 70, halign: "center" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 35, right: 35, bottom: 35 },
      });

      // Sección 2: Evolución Mensual y Balance Local (40%)
      const nextY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 320;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(27, 37, 89);
      doc.text("Evolución Mensual y Balance de Comisión Local (40%)", 35, nextY + 22);

      const monthlyHeaders = [
        "Período / Mes",
        "Unidades",
        "Ventas ($)",
        "Utilidad ($)",
        "Com. Asesores (60%)",
        "Com. Local (40%)",
        "Gastos Operativos",
        "Saldo Neto Local",
      ];

      const monthlyData = monthlyBreakdown.map((m) => [
        m.label,
        m.unidades,
        `$${m.total_ventas.toFixed(2)}`,
        `$${m.utilidad.toFixed(2)}`,
        `$${m.comision_asesores.toFixed(2)}`,
        `$${m.comision_local.toFixed(2)}`,
        `$${m.gastos.toFixed(2)}`,
        `$${m.saldo_comision_local.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: nextY + 28,
        head: [monthlyHeaders],
        body: monthlyData,
        theme: "striped",
        headStyles: {
          fillColor: [179, 74, 50], // #b34a32 Terracotta
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [45, 55, 72],
        },
        columnStyles: {
          // 0: Mes automático
          1: { cellWidth: 50, halign: "center" },
          2: { cellWidth: 80, halign: "right" },
          3: { cellWidth: 80, halign: "right" },
          4: { cellWidth: 90, halign: "right" },
          5: { cellWidth: 90, halign: "right", fontStyle: "bold" },
          6: { cellWidth: 85, halign: "right" },
          7: { cellWidth: 90, halign: "right", fontStyle: "bold" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 35, right: 35, bottom: 35 },
        didDrawPage: (pageData) => {
          const pageStr = `Página ${pageData.pageNumber} de ${doc.getNumberOfPages()}`;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(140, 150, 165);
          doc.text(pageStr, pageWidth - 35, doc.internal.pageSize.getHeight() - 15, { align: "right" });
          doc.text("Mi Hogar y Confort - Sistema de Gestión Financiera y Comisiones", 35, doc.internal.pageSize.getHeight() - 15);
        },
      });

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileNameBase}.pdf"`,
        },
      });
    }

    return new NextResponse("Formato no soportado. Use csv, xlsx o pdf.", { status: 400 });
  } catch (error) {
    console.error("Error en endpoint de exportación financiera:", error);
    return new NextResponse("Error interno al exportar reportes", { status: 500 });
  }
}
