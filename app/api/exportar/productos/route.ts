import { NextResponse } from "next/server";
import { getProductsForExport } from "@/src/services/products/products";

export async function GET() {
  try {
    const products = await getProductsForExport();

    const headers = [
      "ID",
      "Código Interno (SKU)",
      "Código de Barras (GS1)",
      "Producto / Descripción",
      "Categoría",
      "Tipo",
      "Tamaño / Medida",
      "Marca",
      "Material",
      "Stock Total",
      "Costo Compra (+IVA)",
      "Precio Venta (PVP)",
      "Margen Estimado ($)",
      "% Margen",
      "Estado",
    ];

    const escapeCsv = (val: unknown) => {
      const str = val === null || val === undefined ? "" : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = (products ?? []).map((p) => [
      p.id_producto,
      escapeCsv(p.codigo_interno),
      escapeCsv(p.codigo_gs1),
      escapeCsv(p.descripcion),
      escapeCsv(p.categoria),
      escapeCsv(p.tipo),
      escapeCsv(p.tamano),
      escapeCsv(p.marca),
      escapeCsv(p.material),
      p.stock_total,
      Number(p.costo_compra).toFixed(2),
      Number(p.precio_venta).toFixed(2),
      Number(p.margen_estimado).toFixed(2),
      `${p.porcentaje_margen}%`,
      escapeCsv(p.estado),
    ]);

    // BOM UTF-8 (\uFEFF) para apertura inmediata en Excel con tildes y caracteres especiales
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="catalogo_productos_precios_${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error al exportar catálogo de productos a Excel/CSV:", error);
    return new NextResponse("Error al exportar productos", { status: 500 });
  }
}
