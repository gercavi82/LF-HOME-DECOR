-- ==============================================================================
-- L&F HOME DECOR - FASE 11: IMPORTACIÓN Y CARGA DE DATOS EN MYSQL / MARIADB
-- Archivo: database/migration/03_import_mysql.sql
-- Ejecutar en phpMyAdmin o CLI de MySQL / MariaDB
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = "+00:00";

-- ------------------------------------------------------------------------------
-- 1. CATÁLOGOS BASE Y CONTROL DE ACCESO
-- ------------------------------------------------------------------------------

-- Perfiles
INSERT INTO `perfiles` (`id_perfil`, `codigo`, `nombre`, `descripcion`, `activo`, `fecha_creacion`) VALUES
(1, 'ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1, NOW()),
(2, 'VENTA_LOCAL', 'Venta Local', 'Operación comercial e inventario del local asignado', 1, NOW()),
(3, 'ASESOR', 'Asesor', 'Consulta de productos y registro de sus propias ventas', 1, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = VALUES(`activo`);

-- Permisos
INSERT INTO `permisos` (`id_permiso`, `codigo`, `nombre`, `descripcion`, `activo`, `fecha_creacion`) VALUES
(1, 'DASHBOARD_VER', 'Ver Dashboard', 'Permite visualizar estadísticas e indicadores generales', 1, NOW()),
(2, 'PRODUCTO_VER', 'Ver Productos', 'Permite consultar el catálogo y fichas de productos', 1, NOW()),
(3, 'PRODUCTO_CREAR', 'Crear Productos', 'Permite registrar nuevos productos y variantes', 1, NOW()),
(4, 'PRODUCTO_EDITAR', 'Editar Productos', 'Permite modificar datos de productos existentes', 1, NOW()),
(5, 'PRODUCTO_PRECIO', 'Modificar Precios', 'Permite cambiar precios de venta de variantes', 1, NOW()),
(6, 'INVENTARIO_VER', 'Ver Inventario', 'Permite consultar existencias consolidadas por bodega', 1, NOW()),
(7, 'INVENTARIO_AJUSTAR', 'Ajustar Inventario', 'Permite realizar ajustes manuales de stock', 1, NOW()),
(8, 'VENTA_VER', 'Ver Ventas', 'Permite consultar historial y comprobantes de ventas', 1, NOW()),
(9, 'VENTA_CREAR', 'Registrar Ventas', 'Permite procesar nuevas ventas en el punto de venta', 1, NOW()),
(10, 'VENTA_ANULAR', 'Anular Ventas', 'Permite anular ventas emitidas y revertir stock', 1, NOW()),
(11, 'USUARIO_VER', 'Ver Usuarios', 'Permite consultar la lista de usuarios del sistema', 1, NOW()),
(12, 'USUARIO_CREAR', 'Crear Usuarios', 'Permite registrar nuevos usuarios y asignar perfiles', 1, NOW()),
(13, 'USUARIO_EDITAR', 'Editar Usuarios', 'Permite modificar usuarios y resetear contraseñas', 1, NOW()),
(14, 'USUARIO_ESTADO', 'Cambiar Estado de Usuarios', 'Permite activar, desactivar o bloquear usuarios', 1, NOW()),
(15, 'AUDITORIA_VER', 'Ver Auditoría', 'Permite consultar el registro histórico de actividades', 1, NOW()),
(16, 'CONFIGURACION_VER', 'Ver Configuración', 'Permite consultar y modificar catálogos y parámetros', 1, NOW()),
(17, 'FINANZAS_VER', 'Ver Finanzas', 'Permite consultar reportes financieros y estados de cuenta', 1, NOW()),
(18, 'REPORTES_VER', 'Ver Reportes', 'Permite consultar reportes consolidados del sistema', 1, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = VALUES(`activo`);

-- Perfil - Permisos (Administrador hereda todos)
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT 1, id_permiso FROM `permisos` WHERE `activo` = 1;

-- Locales
INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`, `fecha_creacion`) VALUES
(1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `direccion` = VALUES(`direccion`), `activo` = VALUES(`activo`);

-- ------------------------------------------------------------------------------
-- 2. USUARIOS MIEBRADOS Y ACTIVACIÓN DE CREDENCIALES
-- Cédula = Password Temporal con hash bcrypt
-- debe_cambiar_password = 1 (para usuarios migrados)
-- ------------------------------------------------------------------------------

-- Administrador Principal (no obligado a cambiar clave)
INSERT INTO `usuarios` (
  `id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`,
  `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`,
  `intentos_fallidos`, `bloqueado`, `activo`, `ultimo_acceso`, `fecha_creacion`
) VALUES (
  1,
  '1712345678',
  'Administrador',
  'Principal',
  'admin@lfhomedecor.com',
  '0999999999',
  1,
  1,
  '$2a$12$R.uJd7h555l2iA45w7F7iOBXUv0J1V/G9o45Yc/2bYxWc5Z/9OQce',
  0,
  0,
  0,
  1,
  NULL,
  NOW()
)
ON DUPLICATE KEY UPDATE 
  `nombres` = VALUES(`nombres`),
  `apellidos` = VALUES(`apellidos`),
  `correo` = VALUES(`correo`),
  `id_perfil` = 1,
  `debe_cambiar_password` = 0,
  `activo` = 1;

-- ------------------------------------------------------------------------------
-- 3. CATÁLOGOS AUXILIARES DE PRODUCTOS
-- ------------------------------------------------------------------------------

INSERT INTO `categorias` (`id_categoria`, `codigo`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'SAB', 'Sábanas', 'Juegos de sábanas y protectores', 1),
(2, 'ALM', 'Almohadas', 'Almohadas ortopédicas y tradicionales', 1),
(3, 'DUV', 'Duvets', 'Duvets, plumones y edredones', 1),
(4, 'TOA', 'Toallas', 'Toallas de baño y mano', 1),
(5, 'COR', 'Cortinas', 'Cortinas para sala y dormitorio', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

INSERT INTO `marcas` (`id_marca`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'L&F Premium', 'Línea de alta gama exclusiva', 1),
(2, 'Home Comfort', 'Línea confort para el hogar', 1),
(3, 'Classic Decor', 'Estilo clásico tradicional', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

INSERT INTO `tipos_producto` (`id_tipo`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'Juego Completo', 'Incluye sábana plana, ajustable y fundas', 1),
(2, 'Individual', 'Pieza unitaria', 1),
(3, 'Set Dúo', 'Pack de dos piezas', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

INSERT INTO `materiales` (`id_material`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'Algodón 100%', 'Algodón suave transpirable de alta densidad', 1),
(2, 'Microfibra', 'Microfibra cepillada hipoalergénica', 1),
(3, 'Satén', 'Satén de seda brillante y sedoso', 1),
(4, 'Lino', 'Lino natural europeo', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

INSERT INTO `tamanos` (`id_tamano`, `nombre`, `descripcion`, `activo`) VALUES
(1, '1.5 Plazas (Twin)', 'Medida para cama de 1.5 plazas (105x190 cm)', 1),
(2, '2 Plazas (Full)', 'Medida para cama de 2 plazas (135x190 cm)', 1),
(3, '2.5 Plazas (Queen)', 'Medida para cama de 2.5 plazas (160x200 cm)', 1),
(4, '3 Plazas (King)', 'Medida para cama de 3 plazas (200x200 cm)', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

INSERT INTO `colores` (`id_color`, `nombre`, `codigo_hex`, `activo`) VALUES
(1, 'Blanco Puro', '#FFFFFF', 1),
(2, 'Gris Perla', '#CCCCCC', 1),
(3, 'Azul Marino', '#002244', 1),
(4, 'Terracota', '#C96D4D', 1),
(5, 'Beige Arena', '#E8DEC8', 1),
(6, 'Palo de Rosa', '#DDA0DD', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `codigo_hex` = VALUES(`codigo_hex`), `activo` = VALUES(`activo`);

INSERT INTO `disenos` (`id_diseno`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'Llano / Liso', 'Acabado liso sin patrones', 1),
(2, 'Bordado Clásico', 'Detalles bordados en filos y cenefas', 1),
(3, 'Estampado Floral', 'Estampados florales decorativos', 1),
(4, 'Geométrico', 'Patrones geométricos modernos', 1),
(5, 'Rayas', 'Diseño a rayas horizontales o verticales', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = VALUES(`activo`);

INSERT INTO `unidades_medida` (`id_unidad`, `codigo`, `nombre`, `activo`) VALUES
(1, 'UND', 'Unidad', 1),
(2, 'JGO', 'Juego', 1),
(3, 'PAR', 'Par', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

-- Formas de Pago y Canales
INSERT INTO `formas_pago` (`id_forma_pago`, `codigo`, `nombre`, `requiere_referencia`, `activo`) VALUES
(1, 'EFECTIVO', 'Efectivo', 0, 1),
(2, 'TRANSFERENCIA', 'Transferencia', 1, 1),
(3, 'TARJETA', 'Tarjeta', 1, 1),
(4, 'DEUNA', 'DeUna', 1, 1),
(5, 'MIXTO', 'Mixto', 0, 1),
(6, 'CREDITO_INTERNO', 'Crédito interno', 0, 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `requiere_referencia` = VALUES(`requiere_referencia`), `activo` = VALUES(`activo`);

INSERT INTO `canales_venta` (`id_canal`, `codigo`, `nombre`, `activo`) VALUES
(1, 'LOCAL', 'Local', 1),
(2, 'ASESOR', 'Asesor', 1),
(3, 'WHATSAPP', 'WhatsApp', 1),
(4, 'FACEBOOK', 'Facebook', 1),
(5, 'INSTAGRAM', 'Instagram', 1),
(6, 'TIKTOK', 'TikTok', 1),
(7, 'OTROS', 'Otros', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

-- Parámetros del Sistema
INSERT INTO `parametros_sistema` (`id_parametro`, `codigo`, `valor`, `descripcion`, `tipo_dato`, `editable`) VALUES
(1, 'IVA_PORCENTAJE', '15', 'Porcentaje de IVA aplicado a nuevos productos', 'NUMERIC', 1),
(2, 'ALERTA_STOCK', '5', 'Cantidad predeterminada para alerta de stock', 'NUMERIC', 1),
(3, 'COMISION_ASESOR', '60', 'Porcentaje de participación del asesor', 'NUMERIC', 1),
(4, 'COMISION_LOCAL', '40', 'Porcentaje de participación del local', 'NUMERIC', 1)
ON DUPLICATE KEY UPDATE `valor` = VALUES(`valor`), `descripcion` = VALUES(`descripcion`);

-- Bodegas
INSERT INTO `bodegas` (`id_bodega`, `id_local`, `nombre`, `activo`, `fecha_creacion`) VALUES
(1, 1, 'Bodega Principal Matriz', 1, NOW()),
(2, 1, 'Exhibición Local Matriz', 1, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = VALUES(`activo`);

SET FOREIGN_KEY_CHECKS = 1;
