import "server-only";
import { execute } from "@/src/lib/db/mysql";

let tablesEnsured = false;

export async function ensureCustomTables() {
  if (tablesEnsured) return;

  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS \`pagos_compras\` (
        \`id_pago_compra\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`id_compra\` BIGINT NOT NULL,
        \`fecha\` DATE NOT NULL,
        \`monto\` DECIMAL(12,2) NOT NULL,
        \`forma_pago\` VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
        \`referencia\` VARCHAR(100) NULL,
        \`observaciones\` TEXT NULL,
        \`registrado_por\` BIGINT NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`fecha_creacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_pagos_compras_fecha\` (\`fecha\`),
        INDEX \`idx_pagos_compras_compra\` (\`id_compra\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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
        INDEX \`idx_pagos_comisiones_fecha\` (\`fecha\`),
        INDEX \`idx_pagos_comisiones_usuario\` (\`id_usuario\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Asegurar Canales de Venta
    await execute(`
      CREATE TABLE IF NOT EXISTS \`canales_venta\` (
        \`id_canal\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nombre\` VARCHAR(100) NOT NULL,
        \`codigo\` VARCHAR(50) NOT NULL UNIQUE,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`canales_venta\` (\`id_canal\`, \`nombre\`, \`codigo\`, \`activo\`) VALUES
      (1, 'Venta Local Matriz', 'LOCAL', 1),
      (2, 'Venta por Asesor', 'ASESOR', 1)
      ON DUPLICATE KEY UPDATE \`activo\` = 1;
    `).catch(() => null);

    // Asegurar Formas de Pago
    await execute(`
      CREATE TABLE IF NOT EXISTS \`formas_pago\` (
        \`id_forma_pago\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nombre\` VARCHAR(100) NOT NULL,
        \`codigo\` VARCHAR(50) NOT NULL UNIQUE,
        \`requiere_referencia\` TINYINT(1) NOT NULL DEFAULT 0,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    // Desactivar Tarjetas de crédito/débito y asegurar formas de pago válidas
    await execute(`UPDATE \`formas_pago\` SET \`activo\` = 0 WHERE \`codigo\` LIKE '%TARJETA%' OR \`nombre\` LIKE '%Tarjeta%'`).catch(() => null);
    await execute(`
      INSERT INTO \`formas_pago\` (\`id_forma_pago\`, \`nombre\`, \`codigo\`, \`requiere_referencia\`, \`activo\`) VALUES
      (1, 'Efectivo', 'EFECTIVO', 0, 1),
      (2, 'Transferencia Bancaria', 'TRANSFERENCIA', 1, 1),
      (3, 'De Una', 'DE_UNA', 1, 1),
      (4, 'Mixto (Efectivo + Transferencia)', 'MIXTO', 0, 1)
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`codigo\` = VALUES(\`codigo\`), \`requiere_referencia\` = VALUES(\`requiere_referencia\`), \`activo\` = 1;
    `).catch(() => null);

    // Eliminar / desactivar usuario Iralda Manoslavas / Manosalvas si existe
    await execute(`DELETE FROM \`sesiones_usuario\` WHERE \`id_usuario\` IN (SELECT \`id_usuario\` FROM \`usuarios\` WHERE \`cedula\` = '1712345673' OR \`nombres\` LIKE '%Iralda%' OR \`apellidos\` LIKE '%Manos%')`).catch(() => null);
    await execute(`DELETE FROM \`usuarios\` WHERE \`cedula\` = '1712345673' OR \`nombres\` LIKE '%Iralda%' OR \`apellidos\` LIKE '%Manos%'`).catch(() => null);
    await execute(`UPDATE \`usuarios\` SET \`activo\` = 0 WHERE \`cedula\` = '1712345673' OR \`nombres\` LIKE '%Iralda%' OR \`apellidos\` LIKE '%Manos%'`).catch(() => null);

    // Asegurar Cliente Consumidor Final
    await execute(`
      CREATE TABLE IF NOT EXISTS \`clientes\` (
        \`id_cliente\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`identificacion\` VARCHAR(20) NOT NULL UNIQUE,
        \`nombres\` VARCHAR(100) NOT NULL,
        \`apellidos\` VARCHAR(100) NOT NULL,
        \`razon_social\` VARCHAR(200) NULL,
        \`correo\` VARCHAR(150) NULL,
        \`telefono\` VARCHAR(50) NULL,
        \`direccion\` VARCHAR(255) NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`clientes\` (\`id_cliente\`, \`identificacion\`, \`nombres\`, \`apellidos\`, \`razon_social\`, \`activo\`) VALUES
      (1, '9999999999999', 'Consumidor', 'Final', 'Consumidor Final', 1)
      ON DUPLICATE KEY UPDATE \`activo\` = 1;
    `).catch(() => null);

    // Asegurar Local y Bodega
    await execute(`
      CREATE TABLE IF NOT EXISTS \`locales\` (
        \`id_local\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nombre\` VARCHAR(150) NOT NULL,
        \`codigo\` VARCHAR(50) NULL UNIQUE,
        \`direccion\` VARCHAR(255) NULL,
        \`telefono\` VARCHAR(50) NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`locales\` (\`id_local\` , \`nombre\`, \`codigo\`, \`activo\`) VALUES
      (1, 'Local Matriz', 'MATRIZ', 1)
      ON DUPLICATE KEY UPDATE \`activo\` = 1;
    `).catch(() => null);

    await execute(`
      CREATE TABLE IF NOT EXISTS \`bodegas\` (
        \`id_bodega\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nombre\` VARCHAR(150) NOT NULL,
        \`id_local\` INT NOT NULL,
        \`descripcion\` VARCHAR(255) NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`bodegas\` (\`id_bodega\`, \`nombre\`, \`id_local\`, \`activo\`) VALUES
      (1, 'Bodega Principal Matriz', 1, 1)
      ON DUPLICATE KEY UPDATE \`activo\` = 1;
    `).catch(() => null);

    tablesEnsured = true;
  } catch (error) {
    console.error("ensureCustomTables error (non-fatal):", error);
  }
}
