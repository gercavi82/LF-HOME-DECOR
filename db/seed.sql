-- ==============================================================================
-- L&F HOME DECOR - SEED DATA INICIAL MARIADB / MYSQL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFILES DE USUARIO
-- ------------------------------------------------------------------------------
INSERT INTO `perfiles` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
('ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1),
('VENTA_LOCAL', 'Venta Local', 'Operación comercial e inventario del local asignado', 1),
('ASESOR', 'Asesor', 'Consulta de productos y registro de sus propias ventas', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = 1;

-- ------------------------------------------------------------------------------
-- 2. CATÁLOGO DE PERMISOS
-- ------------------------------------------------------------------------------
INSERT INTO `permisos` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
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
('USUARIO_VER', 'Ver Usuarios', 'Permite consultar la lista de usuarios del sistema', 1),
('USUARIO_CREAR', 'Crear Usuarios', 'Permite registrar nuevos usuarios y asignar perfiles', 1),
('USUARIO_EDITAR', 'Editar Usuarios', 'Permite modificar usuarios y resetear contraseñas', 1),
('USUARIO_ESTADO', 'Cambiar Estado de Usuarios', 'Permite activar, desactivar o bloquear usuarios', 1),
('AUDITORIA_VER', 'Ver Auditoría', 'Permite consultar el registro histórico de actividades', 1),
('CONFIGURACION_VER', 'Ver Configuración', 'Permite consultar y modificar catálogos y parámetros', 1),
('FINANZAS_VER', 'Ver Finanzas', 'Permite consultar reportes financieros y estados de cuenta', 1),
('REPORTES_VER', 'Ver Reportes', 'Permite consultar reportes consolidados del sistema', 1),
('GASTOS_VER', 'Ver Gastos', 'Permite consultar el registro de gastos del negocio', 1),
('GASTOS_CREAR', 'Registrar Gastos', 'Permite registrar nuevos gastos y costos', 1),
('GASTOS_EDITAR', 'Editar Gastos', 'Permite modificar o anular gastos', 1),
('COMISIONES_VER', 'Ver Comisiones', 'Permite consultar comisiones y participaciones de asesores', 1),
('COMISIONES_PAGAR', 'Liquidar Comisiones', 'Permite registrar pagos y liquidaciones de comisiones', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = 1;

-- ------------------------------------------------------------------------------
-- 3. ASIGNACIÓN PERFILES - PERMISOS
-- ------------------------------------------------------------------------------
-- Administrador: todos los permisos
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
CROSS JOIN permisos perm
WHERE p.codigo = 'ADMINISTRADOR' AND perm.activo = 1;

-- Venta Local: permisos operativos
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
JOIN permisos perm ON perm.codigo IN (
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'INVENTARIO_AJUSTAR', 'VENTA_VER', 'VENTA_CREAR'
)
WHERE p.codigo = 'VENTA_LOCAL' AND perm.activo = 1;

-- Asesor: permisos comerciales individuales
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
JOIN permisos perm ON perm.codigo IN (
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'VENTA_VER', 'VENTA_CREAR'
)
WHERE p.codigo = 'ASESOR' AND perm.activo = 1;

-- ------------------------------------------------------------------------------
-- 4. LOCAL PRINCIPAL Y BODEGA
-- ------------------------------------------------------------------------------
INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`) VALUES
(1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `bodegas` (`id_bodega`, `nombre`, `id_local`, `descripcion`, `activo`) VALUES
(1, 'Bodega Principal Matriz', 1, 'Bodega central de almacenamiento', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- ------------------------------------------------------------------------------
-- 5. CATÁLOGOS AUXILIARES
-- ------------------------------------------------------------------------------
INSERT INTO `categorias` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
('SAB', 'Sábanas', 'Juegos de sábanas y piezas individuales', 1),
('EDR', 'Edredones', 'Edredones y rellenos para dormitorio', 1),
('COB', 'Cobertores', 'Cobertores y mantas', 1),
('ALM', 'Almohadas', 'Almohadas y complementos', 1),
('PRO', 'Protectores', 'Protectores de colchón y almohada', 1),
('TOA', 'Toallas', 'Toallas y textiles de baño', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `marcas` (`nombre`, `descripcion`, `activo`) VALUES
('L&F Home Decor', 'Marca principal de la empresa', 1),
('Genérica', 'Productos sin marca comercial específica', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `materiales` (`nombre`, `descripcion`, `activo`) VALUES
('Algodón', 'Fibra natural de algodón', 1),
('Microfibra', 'Tejido sintético de microfibra', 1),
('Sherpa', 'Tejido térmico tipo sherpa', 1),
('Viscoelástica', 'Espuma viscoelástica', 1),
('Poliéster', 'Fibra sintética de poliéster', 1),
('Impermeable', 'Material con protección contra líquidos', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `tamanos` (`nombre`, `descripcion`, `activo`) VALUES
('Individual', 'Tamaño individual', 1),
('1 1/2 Plazas', 'Tamaño de plaza y media', 1),
('2 Plazas', 'Tamaño matrimonial de dos plazas', 1),
('Queen', 'Tamaño Queen', 1),
('King', 'Tamaño King', 1),
('Estándar', 'Tamaño estándar para complementos', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `tipos_producto` (`nombre`, `descripcion`, `activo`) VALUES
('Textil Hogar', 'Textiles generales de hogar y dormitorio', 1),
('Complementos', 'Accesorios y complementos de descanso', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `colores` (`nombre`, `codigo_hex`, `activo`) VALUES
('Blanco', '#FFFFFF', 1),
('Beige', '#F5F5DC', 1),
('Gris', '#808080', 1),
('Azul Marino', '#000080', 1),
('Terracota', '#E2725B', 1)
ON DUPLICATE KEY UPDATE `codigo_hex` = VALUES(`codigo_hex`), `activo` = 1;

INSERT INTO `disenos` (`nombre`, `descripcion`, `activo`) VALUES
('Liso', 'Diseño en color entero sin patrones', 1),
('Estampado', 'Diseño con motivos gráficos variados', 1),
('Rayas', 'Diseño a rayas horizontales o verticales', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `unidades_medida` (`codigo`, `nombre`, `activo`) VALUES
('UND', 'Unidad', 1),
('JGO', 'Juego', 1),
('PAR', 'Par', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- ------------------------------------------------------------------------------
-- 6. FORMAS DE PAGO Y CANALES DE VENTA
-- ------------------------------------------------------------------------------
INSERT INTO `formas_pago` (`codigo`, `nombre`, `requiere_referencia`, `activo`) VALUES
('EFECTIVO', 'Efectivo', 0, 1),
('TRANSFERENCIA', 'Transferencia', 1, 1),
('TARJETA', 'Tarjeta', 1, 1),
('DEUNA', 'DeUna', 1, 1),
('MIXTO', 'Mixto', 0, 1),
('CREDITO_INTERNO', 'Crédito interno', 0, 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `requiere_referencia` = VALUES(`requiere_referencia`), `activo` = 1;

INSERT INTO `canales_venta` (`codigo`, `nombre`, `activo`) VALUES
('LOCAL', 'Local', 1),
('ASESOR', 'Asesor', 1),
('WHATSAPP', 'WhatsApp', 1),
('FACEBOOK', 'Facebook', 1),
('INSTAGRAM', 'Instagram', 1),
('TIKTOK', 'TikTok', 1),
('OTROS', 'Otros', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- ------------------------------------------------------------------------------
-- 7. PARÁMETROS DEL SISTEMA
-- ------------------------------------------------------------------------------
INSERT INTO `parametros_sistema` (`codigo`, `valor`, `descripcion`, `tipo_dato`, `editable`) VALUES
('IVA_PORCENTAJE', '15', 'Porcentaje de IVA aplicado a nuevos productos', 'NUMERIC', 1),
('ALERTA_STOCK', '5', 'Cantidad predeterminada para alerta de stock', 'NUMERIC', 1),
('COMISION_ASESOR', '60', 'Porcentaje de participación del asesor', 'NUMERIC', 1),
('COMISION_LOCAL', '40', 'Porcentaje de participación del local', 'NUMERIC', 1)
ON DUPLICATE KEY UPDATE `valor` = VALUES(`valor`), `descripcion` = VALUES(`descripcion`);

-- ------------------------------------------------------------------------------
-- 8. USUARIO ADMINISTRADOR PRINCIPAL
-- Cédula: 1712345678
-- Para configurar una contraseña personalizada: npm run seed:admin -- --password=SuClave
-- ------------------------------------------------------------------------------
INSERT INTO `usuarios` (
  `id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`,
  `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`,
  `intentos_fallidos`, `bloqueado`, `activo`, `ultimo_acceso`
) VALUES (
  1,
  '1712345678',
  'Administrador',
  'Principal',
  'admin@lfhomedecor.com',
  '0999999999',
  1,
  1,
  '$2a$12$R.uJd7h555l2iA45w7F7iOBXUv0J1V/G9o45Yc/2bYxWc5Z/9OQce', -- hash bcrypt
  0,
  0,
  0,
  1,
  NULL
)
ON DUPLICATE KEY UPDATE 
  `nombres` = VALUES(`nombres`),
  `apellidos` = VALUES(`apellidos`),
  `correo` = VALUES(`correo`),
  `id_perfil` = 1,
  `debe_cambiar_password` = 0,
  `intentos_fallidos` = 0,
  `bloqueado` = 0,
  `activo` = 1;
