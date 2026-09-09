import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { listPurchases } from "@/src/services/purchases/purchases";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = (searchParams.get("formato") || "xlsx").toLowerCase();
    const q = searchParams.get("q") || "";
    const desde = searchParams.get("desde") || "";
    const hasta = searchParams.get("hasta") || "";
    const proveedor = searchParams.get("proveedor") || "";
    const estadoPago = searchParams.get("estadoPago") || "";
    const anio = searchParams.get("anio") || "";
    const mes = searchParams.get("mes") || "";
    const tipo = searchParams.get("tipo") || "";

    const { purchases, summary } = await listPurchases({
      q,
      desde,
      hasta,
      proveedorId: proveedor,
      estadoPago,
      year: anio,
      month: mes,
      tipoId: tipo,
      limit: 5000,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const fileNameBase = `reporte_compras_${todayStr}`;

    // 1. FORMATO CSV
    if (formato === "csv") {
      const headers = [
        "ID Compra",
        "Nº Factura / Compra",
        "Fecha",
        "Proveedor",
        "Productos",
        "Cant. Unidades",
        "Subtotal ($)",
        "IVA ($)",
        "Total ($)",
        "Total Abonado ($)",
        "Saldo Pendiente ($)",
        "Estado Pago",
        "Observaciones",
      ];

      const escapeCsv = (val: unknown) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = purchases.map((p) => [
        p.id_compra,
        escapeCsv(p.numero_compra),
        escapeCsv(p.fecha),
        escapeCsv(p.proveedor),
        escapeCsv(p.producto || ""),
        p.unidades,
        p.subtotal.toFixed(2),
        p.iva.toFixed(2),
        p.total.toFixed(2),
        p.total_pagado.toFixed(2),
        p.saldo_pendiente.toFixed(2),
        escapeCsv(p.estado_pago),
        escapeCsv(p.observaciones ?? ""),
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
      const dataRows = purchases.map((p) => ({
        "ID Compra": p.id_compra,
        "Nº Factura / Compra": p.numero_compra,
        "Fecha": p.fecha,
        "Proveedor": p.proveedor,
        "Productos": p.producto || "",
        "Cant. Unidades": p.unidades,
        "Subtotal ($)": Number(p.subtotal.toFixed(2)),
        "IVA ($)": Number(p.iva.toFixed(2)),
        "Total Factura ($)": Number(p.total.toFixed(2)),
        "Abonos Aplicados ($)": Number(p.total_pagado.toFixed(2)),
        "Saldo Pendiente ($)": Number(p.saldo_pendiente.toFixed(2)),
        "Estado Pago": p.estado_pago,
        "Observaciones": p.observaciones || "",
      }));

      const summaryRows = [
        { "Métrica": "Total Compras Registradas ($)", "Valor": summary.total },
        { "Métrica": "Total Depósitos / Abonos Realizados ($)", "Valor": summary.totalPagado },
        { "Métrica": "Total Aplicado a Facturas (FIFO) ($)", "Valor": summary.totalAplicado },
        { "Métrica": "Depósitos Disponibles a Favor ($)", "Valor": summary.depositosDisponibles },
        { "Métrica": "Saldo Pendiente de Liquidar ($)", "Valor": summary.totalPendiente },
        { "Métrica": "Total Unidades de Mercadería", "Valor": summary.unidades },
        { "Métrica": "Total Compras / Facturas", "Valor": purchases.length },
      ];

      const workbook = XLSX.utils.book_new();

      const purchasesSheet = XLSX.utils.json_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(workbook, purchasesSheet, "Detalle Compras");

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

    // 3. FORMATO PDF (DISEÑO CORPORATIVO L&F HOME DECOR)
    if (formato === "pdf") {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Encabezado Corporativo
      doc.setFillColor(27, 37, 89); // #1b2559 Brand Navy
      doc.rect(0, 0, pageWidth, 55, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("L&F HOME DECOR", 35, 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(215, 225, 250);
      doc.text("Reporte Ejecutivo de Compras a Proveedores", 210, 34);

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
      if (anio) filtrosTexto.push(`Año: ${anio}`);
      if (mes) filtrosTexto.push(`Mes: ${mes}`);
      if (estadoPago) filtrosTexto.push(`Estado Pago: ${estadoPago}`);
      if (q) filtrosTexto.push(`Búsqueda: "${q}"`);

      doc.setTextColor(70, 80, 95);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        filtrosTexto.length ? `Filtros aplicados: ${filtrosTexto.join(" | ")}` : "Filtros aplicados: Todas las compras",
        35,
        74
      );

      // Bloques resumen (KPIs)
      const kpis = [
        { label: "TOTAL COMPRAS", val: `$${summary.total.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "TOTAL DEPÓSITOS", val: `$${summary.totalPagado.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "APLICADO (FIFO)", val: `$${summary.totalAplicado.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "SALDO PENDIENTE", val: `$${summary.totalPendiente.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` },
        { label: "UNIDADES ADQUIRIDAS", val: `${summary.unidades} (${purchases.length} compras)` },
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

      // Tabla de Compras
      const tableHeaders = [
        "Nº Factura / Compra",
        "Fecha",
        "Proveedor",
        "Productos",
        "Cant.",
        "Total Factura",
        "Abonado (FIFO)",
        "Saldo Pendiente",
        "Estado Pago",
      ];

      const tableData = purchases.map((p) => [
        p.numero_compra,
        p.fecha ? p.fecha.slice(0, 10) : "-",
        p.proveedor.length > 25 ? `${p.proveedor.slice(0, 23)}...` : p.proveedor,
        (p.producto || "").length > 35 ? `${(p.producto || "").slice(0, 32)}...` : (p.producto || "-"),
        p.unidades,
        `$${p.total.toFixed(2)}`,
        `$${p.total_pagado.toFixed(2)}`,
        `$${p.saldo_pendiente.toFixed(2)}`,
        p.estado_pago,
      ]);

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
          fontSize: 8,
          textColor: [45, 55, 72],
        },
        columnStyles: {
          0: { cellWidth: 85, fontStyle: "bold" },
          1: { cellWidth: 65 },
          2: { cellWidth: 120 },
          3: { cellWidth: 160 },
          4: { cellWidth: 40, halign: "center" },
          5: { cellWidth: 70, halign: "right", fontStyle: "bold" },
          6: { cellWidth: 75, halign: "right" },
          7: { cellWidth: 80, halign: "right", fontStyle: "bold" },
          8: { cellWidth: 75, halign: "center" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 35, right: 35, bottom: 35 },
        didDrawPage: (data) => {
          const pageStr = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(140, 150, 165);
          doc.text(pageStr, pageWidth - 35, doc.internal.pageSize.getHeight() - 15, { align: "right" });
          doc.text("L&F HOME DECOR - Sistema de Gestión de Compras y Proveedores", 35, doc.internal.pageSize.getHeight() - 15);
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
    console.error("Error en endpoint de exportación de compras:", error);
    return new NextResponse("Error interno al exportar compras", { status: 500 });
  }
}
