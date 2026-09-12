import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { listSales } from "@/src/services/sales/sales";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = (searchParams.get("formato") || "xlsx").toLowerCase();
    const q = searchParams.get("q") || "";
    const desde = searchParams.get("desde") || "";
    const hasta = searchParams.get("hasta") || "";
    const asesor = searchParams.get("asesor") || "";
    const local = searchParams.get("local") || "";
    const canal = searchParams.get("canal") || "";
    const estado = searchParams.get("estado") || "";
    const mes = searchParams.get("mes") || "";
    const tipo = searchParams.get("tipo") || "";
    const tamano = searchParams.get("tamano") || "";

    const { sales, summary } = await listSales({
      q,
      desde,
      hasta,
      asesorId: asesor,
      localId: local,
      canalId: canal,
      estado,
      mes,
      tipoId: tipo,
      tamanoId: tamano,
      limit: 5000,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const fileNameBase = `reporte_ventas_${todayStr}`;

    // 1. FORMATO CSV
    if (formato === "csv") {
      const headers = [
        "ID Venta",
        "Nº Venta",
        "Fecha",
        "Local",
        "Cliente",
        "Canal",
        "Asesor / Vendedor",
        "Productos Vendidos",
        "Total ($)",
        "Utilidad ($)",
        "Comisión Asesor 60% ($)",
        "Comisión Local 40% ($)",
        "Unidades",
        "Estado",
        "Observaciones",
      ];

      const escapeCsv = (val: unknown) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = sales.map((s) => [
        s.id_venta,
        escapeCsv(s.numero_venta),
        escapeCsv(s.fecha),
        escapeCsv(s.local),
        escapeCsv(s.cliente),
        escapeCsv(s.canal),
        escapeCsv(s.vendedor),
        escapeCsv(s.productos ?? ""),
        s.total.toFixed(2),
        s.utilidad.toFixed(2),
        s.comision_asesor.toFixed(2),
        s.comision_local.toFixed(2),
        s.unidades,
        escapeCsv(s.estado),
        escapeCsv(s.observaciones ?? ""),
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileNameBase}.csv"`,
        },
      });
    }

    // 2. FORMATO XLSX (EXCEL)
    if (formato === "xlsx") {
      const dataRows = sales.map((s) => ({
        "ID": s.id_venta,
        "Nº Venta": s.numero_venta,
        "Fecha": s.fecha,
        "Local": s.local,
        "Cliente": s.cliente,
        "Canal de Venta": s.canal,
        "Vendedor / Asesor": s.vendedor,
        "Productos": s.productos ?? "",
        "Cant. Unidades": s.unidades,
        "Total Venta ($)": Number(s.total.toFixed(2)),
        "Utilidad Bruta ($)": Number(s.utilidad.toFixed(2)),
        "Comisión Asesor (60%)": Number(s.comision_asesor.toFixed(2)),
        "Comisión Local (40%)": Number(s.comision_local.toFixed(2)),
        "Estado": s.estado,
        "Observaciones": s.observaciones || "",
      }));

      // Resumen ejecutivo en una segunda pestaña o al final
      const summaryRows = [
        { "Métrica": "Ventas Totales ($)", "Valor": summary.totalVentas },
        { "Métrica": "Utilidad Total ($)", "Valor": summary.totalUtilidad },
        { "Métrica": "Total Comisión Asesores (60%) ($)", "Valor": summary.totalComisionAsesor },
        { "Métrica": "Total Comisión Locales (40%) ($)", "Valor": summary.totalComisionLocal },
        { "Métrica": "Total Gastos Registrados ($)", "Valor": summary.totalGastos },
        { "Métrica": "Saldo Neto Comisión Locales ($)", "Valor": summary.saldoComisionLocal },
        { "Métrica": "Total Unidades Vendidas", "Valor": summary.totalUnidades },
        { "Métrica": "Total Transacciones", "Valor": sales.length },
      ];

      const workbook = XLSX.utils.book_new();

      const salesSheet = XLSX.utils.json_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(workbook, salesSheet, "Detalle Ventas");

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen Financiero");

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
      doc.text("Reporte Ejecutivo de Ventas y Comisiones", logoBase64 ? 112 : 35, 34);

      const fechaEmision = new Date().toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.setFontSize(9);
      doc.text(`Emisión: ${fechaEmision}`, pageWidth - 35, 34, { align: "right" });

      // Filtros aplicados
      let filtrosTexto = [];
      if (desde || hasta) filtrosTexto.push(`Rango: ${desde || "Inicio"} al ${hasta || "Hoy"}`);
      if (mes) filtrosTexto.push(`Mes: ${mes}`);
      if (q) filtrosTexto.push(`Búsqueda: "${q}"`);
      if (estado) filtrosTexto.push(`Estado: ${estado}`);

      doc.setTextColor(70, 80, 95);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        filtrosTexto.length ? `Filtros aplicados: ${filtrosTexto.join(" | ")}` : "Filtros aplicados: Todos los registros",
        35,
        74
      );

      // Bloques resumen (KPIs)
      const kpis = [
        { label: "VENTAS TOTALES", val: `$${summary.totalVentas.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "UTILIDAD BRUTA", val: `$${summary.totalUtilidad.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "COMISIÓN ASESOR (60%)", val: `$${summary.totalComisionAsesor.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "COMISIÓN LOCAL (40%)", val: `$${summary.totalComisionLocal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "UNIDADES VENDIDAS", val: `${summary.totalUnidades} (${sales.length} trans.)` },
      ];

      const kpiWidth = (pageWidth - 70 - (kpis.length - 1) * 8) / kpis.length;
      let curX = 35;
      const kpiY = 86;
      const kpiHeight = 40;

      kpis.forEach((kpi) => {
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(220, 226, 235);
        doc.roundedRect(curX, kpiY, kpiWidth, kpiHeight, 4, 4, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(110, 120, 135);
        doc.text(kpi.label, curX + 8, kpiY + 14);

        doc.setFontSize(11);
        doc.setTextColor(27, 37, 89);
        doc.text(kpi.val, curX + 8, kpiY + 30);

        curX += kpiWidth + 8;
      });

      // Tabla de Ventas (sin columna Local, con Producto al lado de Cantidad)
      const tableHeaders = [
        "Nº Venta",
        "Fecha",
        "Cliente",
        "Canal",
        "Vendedor",
        "Producto",
        "Cant.",
        "Total",
        "Com. Asesor",
        "Com. Local",
        "Estado",
      ];

      const tableData = sales.map((s) => {
        const prod = s.productos || "-";
        return [
          s.numero_venta,
          s.fecha ? s.fecha.slice(0, 16) : "-",
          s.cliente.length > 20 ? `${s.cliente.slice(0, 18)}...` : s.cliente,
          s.canal,
          s.vendedor.length > 16 ? `${s.vendedor.slice(0, 14)}...` : s.vendedor,
          prod.length > 42 ? `${prod.slice(0, 40)}...` : prod,
          s.unidades,
          `$${s.total.toFixed(2)}`,
          `$${s.comision_asesor.toFixed(2)}`,
          `$${s.comision_local.toFixed(2)}`,
          s.estado,
        ];
      });

      autoTable(doc, {
        startY: 138,
        head: [tableHeaders],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [27, 37, 89],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "left",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [45, 55, 72],
        },
        columnStyles: {
          0: { cellWidth: 65, fontStyle: "bold" },
          1: { cellWidth: 65 },
          2: { cellWidth: 90 },
          3: { cellWidth: 50 },
          4: { cellWidth: 70 },
          // 5: Producto utiliza ancho dinámico (auto)
          6: { cellWidth: 32, halign: "center" },
          7: { cellWidth: 52, halign: "right", fontStyle: "bold" },
          8: { cellWidth: 55, halign: "right" },
          9: { cellWidth: 55, halign: "right" },
          10: { cellWidth: 42, halign: "center" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 35, right: 35, bottom: 35 },
        didDrawPage: (data) => {
          // Pie de página
          const pageStr = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(140, 150, 165);
          doc.text(pageStr, pageWidth - 35, doc.internal.pageSize.getHeight() - 15, { align: "right" });
          doc.text("Mi Hogar y Confort - Sistema de Gestión Comercial", 35, doc.internal.pageSize.getHeight() - 15);
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
    console.error("Error en endpoint de exportación de ventas:", error);
    return new NextResponse("Error interno al exportar ventas", { status: 500 });
  }
}
