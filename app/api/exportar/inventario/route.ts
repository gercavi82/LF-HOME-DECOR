import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getInventory } from "@/src/services/inventory/inventory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = (searchParams.get("formato") || "xlsx").toLowerCase();
    const q = searchParams.get("q") || "";
    const estado = searchParams.get("estado") || "";

    const inventory = await getInventory(q, estado, 10000);
    const { items, summary } = inventory;

    const todayStr = new Date().toISOString().slice(0, 10);
    const fileNameBase = `reporte_inventario_${todayStr}`;

    const totalUnidades = items.reduce((acc, item) => acc + item.stock_actual, 0);

    // 1. FORMATO CSV
    if (formato === "csv") {
      const headers = [
        "ID Stock",
        "Producto",
        "Código GS1",
        "Bodega",
        "Categoría",
        "Marca",
        "Tamaño",
        "Color",
        "Stock Actual",
        "Stock Mínimo",
        "Estado Stock",
      ];

      const escapeCsv = (val: unknown) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = items.map((item) => [
        item.id_stock,
        escapeCsv(item.producto),
        escapeCsv(item.codigo_gs1),
        escapeCsv(item.bodega),
        escapeCsv(item.categoria ?? ""),
        escapeCsv(item.marca ?? ""),
        escapeCsv(item.tamano ?? ""),
        escapeCsv(item.color ?? ""),
        item.stock_actual,
        item.stock_minimo,
        escapeCsv(item.estado_stock),
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
      const dataRows = items.map((item) => ({
        "ID Stock": item.id_stock,
        "Producto": item.producto,
        "Código GS1": item.codigo_gs1,
        "Bodega": item.bodega,
        "Categoría": item.categoria ?? "",
        "Marca": item.marca ?? "",
        "Tamaño": item.tamano ?? "",
        "Color": item.color ?? "",
        "Stock Actual": item.stock_actual,
        "Stock Mínimo": item.stock_minimo,
        "Estado Stock": item.estado_stock,
      }));

      const summaryRows = [
        { "Métrica": "Total Registros de Stock", "Valor": summary.total },
        { "Métrica": "Artículos Disponibles", "Valor": summary.available },
        { "Métrica": "Artículos Bajo Stock", "Valor": summary.low },
        { "Métrica": "Artículos Agotados", "Valor": summary.out },
        { "Métrica": "Total Unidades Físicas", "Valor": totalUnidades },
        { "Métrica": "Fecha de Corte", "Valor": todayStr },
      ];

      const workbook = XLSX.utils.book_new();

      const itemsSheet = XLSX.utils.json_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, "Existencias Inventario");

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen General");

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
      doc.text("Reporte Ejecutivo de Inventario y Existencias", logoBase64 ? 112 : 35, 34);

      const fechaEmision = new Date().toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.setFontSize(9);
      doc.text(`Emisión: ${fechaEmision}`, pageWidth - 35, 34, { align: "right" });

      // Filtros aplicados
      let filtrosTexto = [];
      if (q) filtrosTexto.push(`Búsqueda: "${q}"`);
      if (estado) filtrosTexto.push(`Estado: ${estado}`);

      doc.setTextColor(70, 80, 95);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        filtrosTexto.length ? `Filtros aplicados: ${filtrosTexto.join(" | ")}` : "Filtros aplicados: Todos los registros de existencias",
        35,
        74
      );

      // Bloques resumen (KPIs)
      const kpis = [
        { label: "REGISTROS TOTALES", val: `${summary.total}` },
        { label: "DISPONIBLES", val: `${summary.available}` },
        { label: "BAJO STOCK", val: `${summary.low}` },
        { label: "AGOTADOS", val: `${summary.out}` },
        { label: "UNIDADES FÍSICAS", val: `${totalUnidades}` },
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

      // Tabla de Inventario
      const tableHeaders = [
        "Producto",
        "Código GS1",
        "Bodega",
        "Detalles / Variante",
        "Stock Actual",
        "Mínimo",
        "Estado",
      ];

      const tableData = items.map((item) => {
        const detalles = [item.categoria, item.marca, item.tamano, item.color].filter(Boolean).join(" · ") || "-";
        return [
          item.producto,
          item.codigo_gs1,
          item.bodega,
          detalles.length > 35 ? `${detalles.slice(0, 32)}...` : detalles,
          item.stock_actual,
          item.stock_minimo,
          item.estado_stock,
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
          // 0: Producto (ancho automático adaptable)
          1: { cellWidth: 90, fontStyle: "bold" },
          2: { cellWidth: 95 },
          3: { cellWidth: 160 },
          4: { cellWidth: 65, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 55, halign: "center" },
          6: { cellWidth: 70, halign: "center" },
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
          doc.text("Mi Hogar y Confort - Sistema de Gestión de Inventario", 35, doc.internal.pageSize.getHeight() - 15);
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
    console.error("Error en endpoint de exportación de inventario:", error);
    return new NextResponse("Error interno al exportar inventario", { status: 500 });
  }
}
