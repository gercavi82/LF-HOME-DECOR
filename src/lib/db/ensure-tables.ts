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

    // Asegurar Canales de Venta (Local, Asesor, WhatsApp, Instagram, TikTok, Facebook, Otros)
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
      (1, 'Local Matriz', 'LOCAL', 1),
      (2, 'Venta por Asesor', 'ASESOR', 1),
      (3, 'WhatsApp', 'WHATSAPP', 1),
      (4, 'Instagram', 'INSTAGRAM', 1),
      (5, 'TikTok', 'TIKTOK', 1),
      (6, 'Facebook', 'FACEBOOK', 1),
      (7, 'Otros Canales', 'OTROS', 1)
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`codigo\` = VALUES(\`codigo\`), \`activo\` = 1;
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

    // Ajustar pagos_compras para soportar depósitos con id_proveedor, monto_aplicado y saldo_disponible
    await execute(`ALTER TABLE \`pagos_compras\` MODIFY \`id_compra\` BIGINT NULL;`).catch(() => null);
    await execute(`ALTER TABLE \`pagos_compras\` ADD COLUMN \`proveedor\` VARCHAR(200) NULL;`).catch(() => null);
    await execute(`ALTER TABLE \`pagos_compras\` ADD COLUMN \`id_proveedor\` INT NULL DEFAULT 1;`).catch(() => null);
    await execute(`ALTER TABLE \`pagos_compras\` ADD COLUMN \`monto_aplicado\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;`).catch(() => null);
    await execute(`ALTER TABLE \`pagos_compras\` ADD COLUMN \`saldo_disponible\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;`).catch(() => null);

    // Asegurar campos de abono y estado de pago en compras
    await execute(`ALTER TABLE \`compras\` ADD COLUMN \`total_abonado\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;`).catch(() => null);
    await execute(`ALTER TABLE \`compras\` ADD COLUMN \`saldo_pendiente\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;`).catch(() => null);
    await execute(`ALTER TABLE \`compras\` ADD COLUMN \`estado_pago\` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE';`).catch(() => null);

    // Asegurar tabla aplicaciones_abonos_proveedor (detalle N:M de conciliación FIFO)
    await execute(`
      CREATE TABLE IF NOT EXISTS \`aplicaciones_abonos_proveedor\` (
        \`id_aplicacion\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`id_pago_cuenta\` BIGINT NOT NULL,
        \`id_compra\` BIGINT NOT NULL,
        \`id_proveedor\` INT NOT NULL,
        \`monto_aplicado\` DECIMAL(12,2) NOT NULL,
        \`fecha_aplicacion\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`creado_por\` BIGINT NULL,
        INDEX \`idx_app_pago\` (\`id_pago_cuenta\`),
        INDEX \`idx_app_compra\` (\`id_compra\`),
        INDEX \`idx_app_prov\` (\`id_proveedor\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Sincronizar id_proveedor en pagos_compras desde compras si es null
    await execute(`
      UPDATE \`pagos_compras\` pc
      JOIN \`compras\` c ON c.id_compra = pc.id_compra
      SET pc.id_proveedor = c.id_proveedor
      WHERE pc.id_proveedor IS NULL OR pc.id_proveedor = 0;
    `).catch(() => null);
    await execute(`
      UPDATE \`pagos_compras\` SET \`id_proveedor\` = 1 WHERE \`id_proveedor\` IS NULL OR \`id_proveedor\` = 0;
    `).catch(() => null);

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

    // Asegurar Perfiles del Sistema (Administrador, Supervisor, Asesor)
    await execute(`
      CREATE TABLE IF NOT EXISTS \`perfiles\` (
        \`id_perfil\` INT AUTO_INCREMENT PRIMARY KEY,
        \`codigo\` VARCHAR(50) NOT NULL UNIQUE,
        \`nombre\` VARCHAR(100) NOT NULL,
        \`descripcion\` VARCHAR(255) NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`perfiles\` (\`id_perfil\`, \`codigo\`, \`nombre\`, \`descripcion\`, \`activo\`) VALUES
      (1, 'ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1),
      (2, 'SUPERVISOR', 'Supervisor', 'Supervisión operativa, control de inventario, compras y gastos', 1),
      (3, 'ASESOR', 'Asesor', 'Consulta de productos, inventario, reportes y registro de ventas', 1)
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`descripcion\` = VALUES(\`descripcion\`), \`activo\` = 1;
    `).catch(() => null);

    // Asegurar Permisos
    await execute(`
      CREATE TABLE IF NOT EXISTS \`permisos\` (
        \`id_permiso\` INT AUTO_INCREMENT PRIMARY KEY,
        \`codigo\` VARCHAR(50) NOT NULL UNIQUE,
        \`nombre\` VARCHAR(100) NOT NULL,
        \`descripcion\` VARCHAR(255) NULL,
        \`activo\` TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await execute(`
      INSERT INTO \`permisos\` (\`codigo\`, \`nombre\`, \`descripcion\`, \`activo\`) VALUES
      ('DASHBOARD_VER', 'Ver Dashboard', 'Permite visualizar estadísticas e indicadores generales', 1),
      ('PRODUCTO_VER', 'Ver Productos', 'Permite consultar el catálogo y fichas de productos', 1),
      ('PRODUCTO_CREAR', 'Crear Productos', 'Permite registrar nuevos productos y variantes', 1),
      ('PRODUCTO_EDITAR', 'Editar Productos', 'Permite modificar datos de productos existentes', 1),
      ('PRODUCTO_PRECIO', 'Modificar Precios', 'Permite cambiar precios de venta de variantes', 1),
      ('INVENTARIO_VER', 'Ver Inventario', 'Permite consultar existencias consolidadas por bodega', 1),
      ('INVENTARIO_AJUSTAR', 'Ajustar Inventario', 'Permite realizar ajustes manuales de stock', 1),
      ('VENTA_VER', 'Ver Ventas', 'Permite consultar historial y comprobantes de ventas', 1),
      ('VENTA_CREAR', 'Registrar Ventas', 'Permite procesar nuevas ventas en el punto de venta', 1),
      ('VENTA_ANULAR', 'Anular Ventas', 'Permite anular ventas emitidas y revertir stock', 1),
      ('COMPRA_VER', 'Ver Compras', 'Permite consultar compras y registrar abonos a proveedores', 1),
      ('COMPRA_CREAR', 'Crear Compras', 'Permite registrar nuevas compras a proveedores', 1),
      ('COMPRA_EDITAR', 'Editar Compras', 'Permite editar compras existentes', 1),
      ('GASTOS_VER', 'Ver Gastos', 'Permite consultar gastos del negocio', 1),
      ('GASTOS_CREAR', 'Registrar Gastos', 'Permite registrar nuevos gastos', 1),
      ('FINANZAS_VER', 'Ver Finanzas', 'Permite consultar reportes financieros', 1),
      ('REPORTES_VER', 'Ver Reportes', 'Permite consultar reportes comerciales', 1),
      ('COMISIONES_VER', 'Ver Comisiones', 'Permite consultar comisiones de asesores', 1),
      ('USUARIO_VER', 'Ver Usuarios', 'Permite consultar lista de usuarios', 1),
      ('USUARIO_CREAR', 'Crear Usuarios', 'Permite crear nuevos usuarios', 1),
      ('USUARIO_EDITAR', 'Editar Usuarios', 'Permite modificar usuarios', 1),
      ('CONFIGURACION_VER', 'Ver Configuración', 'Permite consultar y modificar catálogos', 1)
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`descripcion\` = VALUES(\`descripcion\`), \`activo\` = 1;
    `).catch(() => null);

    // Asegurar Asignaciones perfil_permisos
    await execute(`
      CREATE TABLE IF NOT EXISTS \`perfil_permisos\` (
        \`id_perfil\` INT NOT NULL,
        \`id_permiso\` INT NOT NULL,
        PRIMARY KEY (\`id_perfil\`, \`id_permiso\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Administrador y Supervisor (todos los permisos)
    await execute(`
      INSERT IGNORE INTO \`perfil_permisos\` (\`id_perfil\`, \`id_permiso\`)
      SELECT p.id_perfil, perm.id_permiso
      FROM perfiles p
      CROSS JOIN permisos perm
      WHERE (p.codigo IN ('ADMINISTRADOR', 'SUPERVISOR') OR p.id_perfil IN (1, 2) OR p.nombre IN ('Administrador', 'Supervisor')) AND perm.activo = 1;
    `).catch(() => null);

    // Asesor
    await execute(`
      INSERT IGNORE INTO \`perfil_permisos\` (\`id_perfil\`, \`id_permiso\`)
      SELECT p.id_perfil, perm.id_permiso
      FROM perfiles p
      JOIN permisos perm ON perm.codigo IN (
        'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'VENTA_VER', 'VENTA_CREAR', 'REPORTES_VER'
      )
      WHERE p.codigo = 'ASESOR' AND perm.activo = 1;
    `).catch(() => null);

    // Asegurar parámetros del sistema para comisiones (60/40)
    await execute(`
      INSERT INTO \`parametros_sistema\` (\`codigo\`, \`valor\`, \`descripcion\`, \`tipo_dato\`) VALUES
      ('COMISION_ASESOR', '60', 'Porcentaje de utilidad neta para el asesor comercial', 'NUMERIC'),
      ('COMISION_LOCAL', '40', 'Porcentaje de utilidad neta para el local comercial', 'NUMERIC')
      ON DUPLICATE KEY UPDATE \`valor\` = VALUES(\`valor\`), \`descripcion\` = VALUES(\`descripcion\`);
    `).catch(() => null);

    // Asegurar columnas en variantes_producto
    await execute(`
      ALTER TABLE \`variantes_producto\` ADD COLUMN \`costo_unitario\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);

    // Asegurar columnas en detalle_ventas
    await execute(`
      ALTER TABLE \`detalle_ventas\` ADD COLUMN \`costo_unitario\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);
    await execute(`
      ALTER TABLE \`detalle_ventas\` ADD COLUMN \`costo_total\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);
    await execute(`
      ALTER TABLE \`detalle_ventas\` ADD COLUMN \`utilidad\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);

    // Asegurar columnas en ventas (Persistencia única y fuente de verdad)
    await execute(`
      ALTER TABLE \`ventas\` ADD COLUMN \`costo_total\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);
    await execute(`
      ALTER TABLE \`ventas\` ADD COLUMN \`utilidad\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);
    await execute(`
      ALTER TABLE \`ventas\` ADD COLUMN \`comision_asesor\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);
    await execute(`
      ALTER TABLE \`ventas\` ADD COLUMN \`comision_local\` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    `).catch(() => null);

    // Poblar costo_unitario oficial en variantes_producto con base en catálogo real y compras
    await execute(`
      UPDATE \`variantes_producto\` vp
      SET vp.costo_unitario = CASE 
        WHEN vp.id_variante = 1 THEN 16.00
        WHEN vp.id_variante = 2 THEN 18.00
        WHEN vp.id_variante = 3 THEN 14.50
        WHEN vp.id_variante = 4 THEN 9.00
        WHEN vp.id_variante = 5 THEN 10.50
        WHEN vp.id_variante = 6 THEN 10.00
        WHEN vp.id_variante = 7 THEN 7.50
        WHEN vp.id_variante = 8 THEN 21.00
        WHEN vp.id_variante = 9 THEN 18.00
        WHEN vp.id_variante = 10 THEN 20.00
        WHEN vp.id_variante = 11 THEN 21.00
        WHEN vp.id_variante = 12 THEN 15.00
        WHEN vp.id_variante = 13 THEN 12.00
        WHEN vp.id_variante = 14 THEN 1.50
        WHEN vp.id_variante = 15 THEN 22.00
        WHEN vp.id_variante = 16 THEN 8.00
        WHEN vp.id_variante = 17 THEN 20.00
        WHEN vp.id_variante = 18 THEN 19.00
        WHEN vp.id_variante = 19 THEN 21.00
        ELSE COALESCE(
          (
            SELECT ROUND(dc.total / dc.cantidad, 2) 
            FROM detalle_compras dc 
            JOIN compras c ON c.id_compra = dc.id_compra 
            WHERE dc.id_variante = vp.id_variante AND UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
            ORDER BY c.fecha DESC, dc.id_detalle_compra DESC 
            LIMIT 1
          ),
          0.00
        )
      END;
    `).catch(() => null);

    // Sincronizar detalle_ventas con costo_unitario, costo_total y utilidad exactos
    await execute(`
      UPDATE \`detalle_ventas\` dv
      JOIN \`variantes_producto\` vp ON vp.id_variante = dv.id_variante
      SET 
        dv.costo_unitario = vp.costo_unitario,
        dv.costo_total = ROUND(vp.costo_unitario * dv.cantidad, 2),
        dv.utilidad = GREATEST(0, dv.total - ROUND(vp.costo_unitario * dv.cantidad, 2));
    `).catch(() => null);

    // Sincronizar ventas con costo_total, utilidad, comision_asesor (60%) y comision_local (40%)
    await execute(`
      UPDATE \`ventas\` v
      SET 
        v.costo_total = COALESCE((
          SELECT SUM(dv.costo_total)
          FROM detalle_ventas dv
          WHERE dv.id_venta = v.id_venta
        ), 0.00),
        v.utilidad = GREATEST(0, v.total - COALESCE((
          SELECT SUM(dv.costo_total)
          FROM detalle_ventas dv
          WHERE dv.id_venta = v.id_venta
        ), 0.00)),
        v.comision_asesor = ROUND(GREATEST(0, v.total - COALESCE((
          SELECT SUM(dv.costo_total)
          FROM detalle_ventas dv
          WHERE dv.id_venta = v.id_venta
        ), 0.00)) * 0.60, 2),
        v.comision_local = ROUND(GREATEST(0, v.total - COALESCE((
          SELECT SUM(dv.costo_total)
          FROM detalle_ventas dv
          WHERE dv.id_venta = v.id_venta
        ), 0.00)) * 0.40, 2);
    `).catch(() => null);

    // Ejecutar conciliación FIFO de abonos y compras a proveedores
    try {
      const { reconcileAllSuppliers } = await import("@/src/services/purchases/reconcile-supplier-payments");
      await reconcileAllSuppliers();
    } catch {
      // Ignorar en entornos sin BD inicializada
    }

    tablesEnsured = true;
  } catch (error) {
    console.error("ensureCustomTables error (non-fatal):", error);
  }
}
