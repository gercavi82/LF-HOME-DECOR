import xlsx from "xlsx";
import bcrypt from "bcryptjs";
import { writeFileSync, existsSync } from "node:fs";

const excelPath = "C:\\Users\\german.cajas\\Downloads\\VENTAS_LOCAL_EDREDONES_Y_SABANAS_CONSOLIDADO_FINAL.xlsx";

if (!existsSync(excelPath)) {
  console.error("No se encontró el archivo Excel en:", excelPath);
  process.exit(1);
}

const wb = xlsx.readFile(excelPath);
console.log("Archivo Excel cargado. Hojas disponibles:", wb.SheetNames);

// Unified password hash for '1712345678'
const defaultPasswordHash = bcrypt.hashSync("1712345678", 12);

// 1. Asesores y Usuarios
const advisors = [
  { code: "ADMIN", cedula: "1712345678", nombres: "Administrador", apellidos: "Principal", perfil: 1, correo: "admin@lfhomedecor.com" },
  { code: "AA", cedula: "1712345671", nombres: "Aida", apellidos: "Álvarez", perfil: 3, correo: "aida.alvarez@lfhomedecor.com" },
  { code: "FO", cedula: "1712345672", nombres: "Fernanda", apellidos: "Oñate", perfil: 3, correo: "fernanda.onate@lfhomedecor.com" },
  { code: "IM", cedula: "1712345673", nombres: "Iralda", apellidos: "Manosalvas", perfil: 3, correo: "iralda.manosalvas@lfhomedecor.com" },
  { code: "LQ", cedula: "1712345674", nombres: "Lizeth", apellidos: "Quishpe", perfil: 3, correo: "lizeth.quishpe@lfhomedecor.com" },
  { code: "LOCAL", cedula: "1712345670", nombres: "Ventas", apellidos: "Local Matriz", perfil: 2, correo: "local@lfhomedecor.com" }
];

// 2. Extraer Catálogo de Productos desde Hoja DATOS
const datosWs = wb.Sheets["DATOS"];
const rawDatos = xlsx.utils.sheet_to_json(datosWs, { header: 1 });

const productsMap = new Map();
// Columns in DATOS: C5: ID_PRODUCTO, C6: TIPO, C7: DESCRIPCIÓN, C8: PRECIO COMPRA, C9: PRECIO VENTA
for (let i = 1; i < rawDatos.length; i++) {
  const row = rawDatos[i];
  if (!row) continue;
  const idProducto = row[4]?.toString().trim();
  const tipo = row[5]?.toString().trim();
  const descripcion = row[6]?.toString().trim();
  const costoRaw = row[7]?.toString().replace("$", "").replace(",", ".").trim();
  const precioRaw = row[8]?.toString().replace("$", "").replace(",", ".").trim();

  if (idProducto && tipo && descripcion) {
    const costo = parseFloat(costoRaw) || 0;
    const precio = parseFloat(precioRaw) || 0;
    productsMap.set(idProducto, {
      idProducto,
      tipo,
      descripcion,
      costo,
      precio
    });
  }
}

console.log(`Catálogo extraído: ${productsMap.size} variantes de productos.`);

// 3. Extraer Compras desde Hoja COMPRAS
const comprasWs = wb.Sheets["COMPRAS"];
const rawCompras = xlsx.utils.sheet_to_json(comprasWs, { header: 1 });
const purchasesList = [];

function parseExcelDate(excelDate) {
  if (!excelDate) return "2026-06-01";
  if (typeof excelDate === "number") {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0];
  }
  const str = excelDate.toString().trim();
  const parts = str.split("/");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${y}-${m}-${d}`;
  }
  return "2026-06-01";
}

// Columns in COMPRAS: C1: FECHA, C2: TIPO, C3: DESCRIPCIÓN, C4: ID_PRODUCTO, C5: CANTIDAD, C6: PRECIO SIN IVA, C7: IVA, C8: PRECIO CON IVA, C9: TOTAL COMPRA, C10: PROVEEDOR
for (let i = 2; i < rawCompras.length; i++) {
  const row = rawCompras[i];
  if (!row || !row[3]) continue;
  const fecha = parseExcelDate(row[0]);
  const idProd = row[3]?.toString().trim();
  const cant = parseInt(row[4]) || 0;
  const precioUnit = parseFloat(row[7]?.toString().replace("$", "").replace(",", ".").trim()) || 0;
  const totalCompra = parseFloat(row[8]?.toString().replace("$", "").replace(",", ".").trim()) || (cant * precioUnit);
  const proveedor = row[9]?.toString().trim() || "Distribuidora Nacional de Blancos";

  if (cant > 0 && idProd) {
    purchasesList.push({ fecha, idProd, cant, precioUnit, totalCompra, proveedor });
  }
}
console.log(`Compras extraídas: ${purchasesList.length} registros.`);

// 4. Extraer Ventas desde Hoja VENTAS
const ventasWs = wb.Sheets["VENTAS"];
const rawVentas = xlsx.utils.sheet_to_json(ventasWs, { header: 1 });
const salesList = [];

// Columns in VENTAS: C1: FECHA, C2: CÓD. ASESOR, C3: ASESOR, C4: TIPO, C5: DESCRIPCIÓN, C6: ID_PRODUCTO, C7: CANTIDAD, C8: PRECIO COMPRA, C9: COSTO TOTAL, C10: PRECIO VENTA, C11: VENTA TOTAL, C12: UTILIDAD, C13: COMISIÓN LOCAL, C14: COMISIÓN ASESOR, C17: PAGADO
for (let i = 2; i < rawVentas.length; i++) {
  const row = rawVentas[i];
  if (!row || !row[5]) continue;
  const fecha = parseExcelDate(row[0]);
  const codAsesor = row[1]?.toString().trim() || "LOCAL";
  const idProd = row[5]?.toString().trim();
  const cant = parseInt(row[6]) || 0;
  const costoUnit = parseFloat(row[7]?.toString().replace("$", "").replace(",", ".").trim()) || 0;
  const precioVenta = parseFloat(row[9]?.toString().replace("$", "").replace(",", ".").trim()) || 0;
  const ventaTotal = parseFloat(row[10]?.toString().replace("$", "").replace(",", ".").trim()) || (cant * precioVenta);
  const comisionAsesor = parseFloat(row[13]?.toString().replace("$", "").replace(",", ".").trim()) || 0;
  const comisionLocal = parseFloat(row[12]?.toString().replace("$", "").replace(",", ".").trim()) || 0;
  const pagado = (row[16]?.toString().trim().toUpperCase() === "SI" || row[16]?.toString().trim().toUpperCase() === "PAGADO") ? 1 : 0;

  if (cant > 0 && idProd) {
    salesList.push({
      fecha,
      codAsesor,
      idProd,
      cant,
      costoUnit,
      precioVenta,
      ventaTotal,
      comisionAsesor,
      comisionLocal,
      pagado
    });
  }
}
console.log(`Ventas extraídas: ${salesList.length} registros.`);

// 5. Extraer Gastos desde Hoja COSTOS LOCAL
const gastosList = [
  // Fijos
  { fecha: "2026-06-01", categoria: "FIJO", descripcion: "Servicio de Luz Local Matriz (Junio)", monto: 22.00, beneficiario: "Empresa Eléctrica" },
  { fecha: "2026-06-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Edredones (Junio)", monto: 85.00, beneficiario: "Propietario Local" },
  { fecha: "2026-06-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Artesanías (Junio)", monto: 85.00, beneficiario: "Propietario Local" },
  { fecha: "2026-07-01", categoria: "FIJO", descripcion: "Servicio de Luz Local Matriz (Julio)", monto: 22.00, beneficiario: "Empresa Eléctrica" },
  { fecha: "2026-07-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Edredones (Julio)", monto: 85.00, beneficiario: "Propietario Local" },
  { fecha: "2026-07-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Artesanías (Julio)", monto: 85.00, beneficiario: "Propietario Local" },
  { fecha: "2026-08-01", categoria: "FIJO", descripcion: "Servicio de Luz Local Matriz (Agosto)", monto: 22.00, beneficiario: "Empresa Eléctrica" },
  { fecha: "2026-08-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Edredones (Agosto)", monto: 85.00, beneficiario: "Propietario Local" },
  { fecha: "2026-08-01", categoria: "FIJO", descripcion: "Arriendo Local Matriz - Línea Artesanías (Agosto)", monto: 85.00, beneficiario: "Propietario Local" },

  // Mejoras y Variables
  { fecha: "2026-06-15", categoria: "MEJORAS", descripcion: "Mano de obra mejoras local", monto: 50.00, beneficiario: "Maestro de obra" },
  { fecha: "2026-06-15", categoria: "MEJORAS", descripcion: "Madera y estructuras para exhibición", monto: 190.00, beneficiario: "Maderera" },
  { fecha: "2026-06-15", categoria: "MEJORAS", descripcion: "Luminarias y luces LED", monto: 48.00, beneficiario: "Ferretería Eléctrica" },
  { fecha: "2026-06-15", categoria: "MEJORAS", descripcion: "Instalación de luces y puntos eléctricos", monto: 20.00, beneficiario: "Electricista" },

  // Marketing y Operativos
  { fecha: "2026-06-20", categoria: "MARKETING", descripcion: "Suscripción ChatGPT Plus (Automatización de Ventas)", monto: 60.00, beneficiario: "OpenAI" },
  { fecha: "2026-06-25", categoria: "MARKETING", descripcion: "Publicidad en TikTok Ads", monto: 18.00, beneficiario: "TikTok Ads" },
  { fecha: "2026-06-28", categoria: "MARKETING", descripcion: "Registro y renovación de dominio web mihogaryconfort.com", monto: 36.80, beneficiario: "Proveedor Dominio" },
  { fecha: "2026-07-05", categoria: "OPERATIVO", descripcion: "Compra de 10 fundas para cobertor", monto: 12.50, beneficiario: "Distribuidora Fundas" },
  { fecha: "2026-07-10", categoria: "OPERATIVO", descripcion: "Impresión de talonarios de notas de venta y entrega", monto: 16.00, beneficiario: "Imprenta" }
];
console.log(`Gastos estructurados: ${gastosList.length} registros.`);

// 6. Generar Script SQL Maestro: database/migration/05_real_data_seed.sql
let sql = `-- ==============================================================================
-- L&F HOME DECOR - MIGRACIÓN DE DATOS REALES DESDE EXCEL
-- Generado automáticamente desde VENTAS_LOCAL_EDREDONES_Y_SABANAS_CONSOLIDADO_FINAL.xlsx
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ASEGURAR TABLA PROVEEDORES
CREATE TABLE IF NOT EXISTS \`proveedores\` (
  \`id_proveedor\` INT AUTO_INCREMENT PRIMARY KEY,
  \`ruc_cedula\` VARCHAR(20) NOT NULL UNIQUE,
  \`nombre\` VARCHAR(150) NOT NULL,
  \`telefono\` VARCHAR(50) NULL,
  \`correo\` VARCHAR(120) NULL,
  \`direccion\` VARCHAR(255) NULL,
  \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
  \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ASEGURAR TABLA COMPRAS
CREATE TABLE IF NOT EXISTS \`compras\` (
  \`id_compra\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`id_proveedor\` INT NOT NULL,
  \`id_local\` INT NOT NULL,
  \`id_usuario\` BIGINT NOT NULL,
  \`numero_compra\` VARCHAR(50) NOT NULL UNIQUE,
  \`fecha\` DATETIME NOT NULL,
  \`subtotal\` DECIMAL(12,2) NOT NULL,
  \`iva\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`total\` DECIMAL(12,2) NOT NULL,
  \`observaciones\` TEXT NULL,
  \`estado\` VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
  \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_compras_proveedor\` FOREIGN KEY (\`id_proveedor\`) REFERENCES \`proveedores\` (\`id_proveedor\`),
  CONSTRAINT \`fk_compras_local\` FOREIGN KEY (\`id_local\`) REFERENCES \`locales\` (\`id_local\`),
  CONSTRAINT \`fk_compras_usuario\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`),
  INDEX \`idx_compras_fecha\` (\`fecha\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ASEGURAR TABLA DETALLE COMPRAS
CREATE TABLE IF NOT EXISTS \`detalle_compras\` (
  \`id_detalle_compra\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`id_compra\` BIGINT NOT NULL,
  \`id_variante\` BIGINT NOT NULL,
  \`cantidad\` INT NOT NULL,
  \`precio_unitario\` DECIMAL(12,2) NOT NULL,
  \`subtotal\` DECIMAL(12,2) NOT NULL,
  \`iva\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`total\` DECIMAL(12,2) NOT NULL,
  CONSTRAINT \`fk_detalle_compras_compra\` FOREIGN KEY (\`id_compra\`) REFERENCES \`compras\` (\`id_compra\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_detalle_compras_variante\` FOREIGN KEY (\`id_variante\`) REFERENCES \`variantes_producto\` (\`id_variante\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ASEGURAR TABLA GASTOS
CREATE TABLE IF NOT EXISTS \`gastos\` (
  \`id_gasto\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`fecha\` DATE NOT NULL,
  \`categoria\` VARCHAR(50) NOT NULL,
  \`descripcion\` VARCHAR(255) NOT NULL,
  \`monto\` DECIMAL(12,2) NOT NULL,
  \`id_local\` INT NULL,
  \`id_usuario\` BIGINT NULL,
  \`beneficiario\` VARCHAR(150) NULL,
  \`observaciones\` TEXT NULL,
  \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
  \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_gastos_local\` FOREIGN KEY (\`id_local\`) REFERENCES \`locales\` (\`id_local\`) ON DELETE SET NULL,
  CONSTRAINT \`fk_gastos_usuario\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`) ON DELETE SET NULL,
  INDEX \`idx_gastos_fecha\` (\`fecha\`),
  INDEX \`idx_gastos_categoria\` (\`categoria\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ASEGURAR TABLA PAGOS DE COMISIONES (ABONOS)
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
  CONSTRAINT \`fk_pagos_comisiones_usuario\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`),
  CONSTRAINT \`fk_pagos_comisiones_registrador\` FOREIGN KEY (\`registrado_por\`) REFERENCES \`usuarios\` (\`id_usuario\`),
  INDEX \`idx_pagos_comisiones_fecha\` (\`fecha\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ASEGURAR LOCAL Y BODEGA MATRIZ
INSERT INTO \`locales\` (\`id_local\`, \`codigo\`, \`nombre\`, \`direccion\`, \`telefono\`, \`activo\`) VALUES
(1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`activo\` = 1;

INSERT INTO \`bodegas\` (\`id_bodega\`, \`nombre\`, \`id_local\`, \`descripcion\`, \`activo\`) VALUES
(1, 'Bodega Principal Matriz', 1, 'Bodega central de almacenamiento', 1)
ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`activo\` = 1;

-- 6. INSERTAR ASESORES Y USUARIOS REALES (PASSWORD UNIFICADO: 1712345678)
`;

advisors.forEach((adv, idx) => {
  const idUser = idx + 1;
  sql += `INSERT INTO \`usuarios\` (\`id_usuario\`, \`cedula\`, \`nombres\`, \`apellidos\`, \`correo\`, \`telefono\`, \`id_perfil\`, \`id_local\`, \`password_hash\`, \`debe_cambiar_password\`, \`intentos_fallidos\`, \`bloqueado\`, \`activo\`) VALUES
(${idUser}, '${adv.cedula}', '${adv.nombres}', '${adv.apellidos}', '${adv.correo}', '0999999999', ${adv.perfil}, 1, '${defaultPasswordHash}', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE \`nombres\` = VALUES(\`nombres\`), \`apellidos\` = VALUES(\`apellidos\`), \`correo\` = VALUES(\`correo\`), \`id_perfil\` = VALUES(\`id_perfil\`), \`password_hash\` = VALUES(\`password_hash\`), \`activo\` = 1;\n`;
});

// Map products to categories and sizes
const catMapping = {
  "COBERTOR": 3,
  "COBERTOR ECO": 3,
  "COBERTOR ESPECIAL": 3,
  "COBERTOR PLUS OVEJERO": 3,
  "COBERTOR BRAMANTEOVEJERO": 3,
  "SABANAS": 1,
  "SABANAS ECO": 1,
  "CUBRECOLCHON": 5,
  "CUBRE COLCHON": 5,
  "ALMOHADAS": 4,
  "FUNDAS DE ALMOHADA": 4
};

const tamanoMapping = {
  "1 1/2 PLAZAS": 2,
  "2 PLAZAS": 3,
  "2  1/2 PLAZAS": 4,
  "2 1/2 PLAZAS": 4,
  "3 PLAZAS": 5,
  "UNICA": 6,
  "ESTÁNDAR": 6
};

sql += `\n-- 7. INSERTAR PRODUCTOS Y VARIANTES REALES\n`;

let prodIdx = 1;
const variantCodeToId = new Map();

for (const [, p] of productsMap.entries()) {
  const catId = catMapping[p.tipo.toUpperCase()] || 1;
  const tamanoId = tamanoMapping[p.descripcion.toUpperCase().trim()] || 3;
  const descSafe = p.idProducto.replace(/'/g, "\\'");
  const codInterno = `LF-${p.tipo.slice(0, 3).toUpperCase()}-${prodIdx.toString().padStart(3, "0")}`;

  sql += `INSERT INTO \`productos\` (\`id_producto\`, \`id_categoria\`, \`id_tipo\`, \`id_marca\`, \`descripcion\`, \`detalle\`, \`activo\`) VALUES
(${prodIdx}, ${catId}, 1, 1, '${descSafe}', '${descSafe}', 1)
ON DUPLICATE KEY UPDATE \`descripcion\` = VALUES(\`descripcion\`), \`id_categoria\` = VALUES(\`id_categoria\`), \`activo\` = 1;\n`;

  sql += `INSERT INTO \`variantes_producto\` (\`id_variante\`, \`id_producto\`, \`codigo_interno\`, \`codigo_gs1\`, \`id_material\`, \`id_tamano\`, \`id_color\`, \`id_diseno\`, \`id_unidad\`, \`precio_venta\`, \`porcentaje_iva\`, \`stock_minimo\`, \`activo\`) VALUES
(${prodIdx}, ${prodIdx}, '${codInterno}', '${codInterno}', 1, ${tamanoId}, 1, 1, 1, ${p.precio.toFixed(2)}, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE \`precio_venta\` = VALUES(\`precio_venta\`), \`id_tamano\` = VALUES(\`id_tamano\`), \`activo\` = 1;\n`;

  variantCodeToId.set(p.idProducto, prodIdx);
  prodIdx++;
}

// 8. Insertar Proveedor General
sql += `\n-- 8. INSERTAR PROVEEDOR GENERAL\n`;
sql += `INSERT INTO \`proveedores\` (\`id_proveedor\`, \`ruc_cedula\`, \`nombre\`, \`telefono\`, \`correo\`, \`direccion\`, \`activo\`) VALUES
(1, '1790012345001', 'Distribuidora Nacional de Blancos & Edredones', '0998877665', 'contacto@distribuidorablancos.ec', 'Quito, Ecuador', 1)
ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`activo\` = 1;\n`;

// 9. Insertar Compras Reales Agrupadas por Fecha (con múltiples detalles por compra)
sql += `\n-- 9. INSERTAR COMPRAS REALES AGRUPADAS POR FECHA (CON MÚLTIPLES DETALLES)\n`;
sql += `DELETE FROM \`detalle_compras\`;\n`;
sql += `DELETE FROM \`compras\`;\n`;

const purchasesByDate = new Map();
purchasesList.forEach((pur) => {
  if (!purchasesByDate.has(pur.fecha)) {
    purchasesByDate.set(pur.fecha, []);
  }
  purchasesByDate.get(pur.fecha).push(pur);
});

let compraOrderIdx = 1;
for (const [dateStr, items] of purchasesByDate.entries()) {
  const numCompra = `COM-2026-${compraOrderIdx.toString().padStart(4, "0")}`;
  const totalCompra = Number(items.reduce((s, it) => s + it.totalCompra, 0).toFixed(2));
  const subtotal = Number((totalCompra / 1.15).toFixed(2));
  const iva = Number((totalCompra - subtotal).toFixed(2));

  sql += `INSERT INTO \`compras\` (\`id_compra\`, \`id_proveedor\`, \`id_local\`, \`id_usuario\`, \`numero_compra\`, \`fecha\`, \`subtotal\`, \`iva\`, \`total\`, \`observaciones\`, \`estado\`) VALUES
(${compraOrderIdx}, 1, 1, 1, '${numCompra}', '${dateStr} 10:00:00', ${subtotal}, ${iva}, ${totalCompra.toFixed(2)}, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');\n`;

  items.forEach((it) => {
    const varId = variantCodeToId.get(it.idProd) || 1;
    const itSubtotal = Number((it.totalCompra / 1.15).toFixed(2));
    const itIva = Number((it.totalCompra - itSubtotal).toFixed(2));
    sql += `INSERT INTO \`detalle_compras\` (\`id_compra\`, \`id_variante\`, \`cantidad\`, \`precio_unitario\`, \`subtotal\`, \`iva\`, \`total\`) VALUES
(${compraOrderIdx}, ${varId}, ${it.cant}, ${it.precioUnit.toFixed(2)}, ${itSubtotal}, ${itIva}, ${it.totalCompra.toFixed(2)});\n`;
  });

  compraOrderIdx++;
}

// 10. Insertar Gastos
sql += `\n-- 10. INSERTAR GASTOS HISTÓRICOS DEL LOCAL\n`;
sql += `DELETE FROM \`gastos\`;\n`;
gastosList.forEach((g) => {
  const desc = g.descripcion.replace(/'/g, "\\'");
  const ben = g.beneficiario.replace(/'/g, "\\'");
  sql += `INSERT INTO \`gastos\` (\`fecha\`, \`categoria\`, \`descripcion\`, \`monto\`, \`id_local\`, \`id_usuario\`, \`beneficiario\`, \`activo\`) VALUES
('${g.fecha}', '${g.categoria}', '${desc}', ${g.monto.toFixed(2)}, 1, 1, '${ben}', 1);\n`;
});

// 11. Calcular y Asignar Stock de Inventario
sql += `\n-- 11. CALCULAR Y ASIGNAR STOCK DE INVENTARIO INICIAL (COMPRAS - VENTAS)\n`;
sql += `DELETE FROM \`stock_producto\`;\n`;

const variantPurchases = new Map();
const variantSales = new Map();

purchasesList.forEach((pur) => {
  const varId = variantCodeToId.get(pur.idProd);
  if (varId) {
    variantPurchases.set(varId, (variantPurchases.get(varId) || 0) + pur.cant);
  }
});

salesList.forEach((s) => {
  const varId = variantCodeToId.get(s.idProd);
  if (varId) {
    variantSales.set(varId, (variantSales.get(varId) || 0) + s.cant);
  }
});

for (let vId = 1; vId < prodIdx; vId++) {
  const comprados = variantPurchases.get(vId) || 0;
  const vendidos = variantSales.get(vId) || 0;
  const stockActual = Math.max(0, comprados - vendidos);

  sql += `INSERT INTO \`stock_producto\` (\`id_variante\`, \`id_bodega\`, \`cantidad\`, \`fecha_actualizacion\`) VALUES
(${vId}, 1, ${stockActual}, NOW())
ON DUPLICATE KEY UPDATE \`cantidad\` = VALUES(\`cantidad\`);\n`;
}

// 12. Insertar Ventas Históricas
sql += `\n-- 12. INSERTAR VENTAS HISTÓRICAS CON DETALLE Y PAGOS\n`;
sql += `DELETE FROM \`pagos_venta\`;\n`;
sql += `DELETE FROM \`detalle_ventas\`;\n`;
sql += `DELETE FROM \`ventas\`;\n`;

const advisorCodeToUserId = {
  "AA": 2,
  "FO": 3,
  "IM": 4,
  "LQ": 5,
  "LOCAL": 6
};

salesList.forEach((s, idx) => {
  const saleId = idx + 1;
  const userId = advisorCodeToUserId[s.codAsesor] || 6;
  const numVenta = `V-2026-${saleId.toString().padStart(4, "0")}`;
  const varId = variantCodeToId.get(s.idProd) || 1;
  const subtotal = Number((s.ventaTotal / 1.15).toFixed(2));
  const iva = Number((s.ventaTotal - subtotal).toFixed(2));
  const obs = `Venta ${s.codAsesor} - Comis. Asesor $${s.comisionAsesor.toFixed(2)} - Comis. Local $${s.comisionLocal.toFixed(2)}${s.pagado ? ' [PAGADA]' : ' [PENDIENTE]'}`;

  sql += `INSERT INTO \`ventas\` (\`id_venta\`, \`id_local\`, \`id_cliente\`, \`id_canal\`, \`id_usuario\`, \`numero_venta\`, \`fecha\`, \`subtotal\`, \`descuento\`, \`iva\`, \`total\`, \`observaciones\`, \`estado\`) VALUES
(${saleId}, 1, 1, 1, ${userId}, '${numVenta}', '${s.fecha} 12:00:00', ${subtotal}, 0.00, ${iva}, ${s.ventaTotal.toFixed(2)}, '${obs}', 'REGISTRADA');\n`;

  sql += `INSERT INTO \`detalle_ventas\` (\`id_venta\`, \`id_variante\`, \`cantidad\`, \`precio_unitario\`, \`descuento\`, \`porcentaje_iva\`, \`subtotal\`, \`iva\`, \`total\`) VALUES
(${saleId}, ${varId}, ${s.cant}, ${s.precioVenta.toFixed(2)}, 0.00, 15.00, ${subtotal}, ${iva}, ${s.ventaTotal.toFixed(2)});\n`;

  sql += `INSERT INTO \`pagos_venta\` (\`id_venta\`, \`id_forma_pago\`, \`valor\`, \`referencia\`, \`fecha\`) VALUES
(${saleId}, 1, ${s.ventaTotal.toFixed(2)}, 'Efectivo', '${s.fecha} 12:00:00');\n`;
});

// 13. Insertar Abonos y Pagos Iniciales de Comisiones
sql += `\n-- 13. INSERTAR ABONOS Y PAGOS DE COMISIONES REALES
DELETE FROM \`pagos_comisiones\`;
INSERT INTO \`pagos_comisiones\` (\`id_usuario\`, \`fecha\`, \`monto\`, \`forma_pago\`, \`referencia\`, \`observaciones\`, \`registrado_por\`, \`activo\`) VALUES
(2, '2026-06-30', 177.60, 'Transferencia', 'Transf #00129', 'Liquidación completa comisiones Junio - Aida Álvarez', 1, 1),
(5, '2026-07-15', 62.50, 'Transferencia', 'Transf #00184', 'Abono parcial comisiones - Lizeth Quishpe', 1, 1);
`;

sql += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;

const outPath = "database/migration/05_real_data_seed.sql";
writeFileSync(outPath, sql, "utf-8");
console.log(`\n✅ Script SQL maestro generado con éxito en: ${outPath} (${(sql.length / 1024).toFixed(1)} KB)`);
