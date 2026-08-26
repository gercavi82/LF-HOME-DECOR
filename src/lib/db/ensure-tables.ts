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

    tablesEnsured = true;
  } catch (error) {
    console.error("ensureCustomTables error (non-fatal):", error);
  }
}
