-- ==============================================================================
-- L&F HOME DECOR - FASE 4: CONFIGURACIÓN DEL ADMINISTRADOR PRINCIPAL
-- Archivo: database/mysql/15_admin.sql
-- ==============================================================================

-- 1. Asegurar existencia del perfil ADMINISTRADOR
INSERT INTO `perfiles` (`codigo`, `nombre`, `descripcion`, `activo`)
VALUES ('ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- 2. Asignar TODOS los permisos existentes al perfil ADMINISTRADOR
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
CROSS JOIN permisos perm
WHERE p.codigo = 'ADMINISTRADOR' AND perm.activo = 1;

-- 3. Asegurar existencia del local matriz
INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`)
VALUES (1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- 4. Crear o Actualizar el Administrador Principal con datos funcionales
-- NOTA: El password_hash se inicializa con un hash bcrypt válido.
-- Para actualizar la contraseña de forma interactiva y segura, use: npm run seed:admin
SET @perfil_admin_id = (SELECT `id_perfil` FROM `perfiles` WHERE `codigo` = 'ADMINISTRADOR' LIMIT 1);
SET @local_matriz_id = (SELECT `id_local` FROM `locales` WHERE `codigo` = 'MATRIZ' LIMIT 1);

-- Hash bcrypt de ejemplo para instalación inicial: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
-- Puede ser actualizado con scripts/seed-admin.mjs
INSERT INTO `usuarios` (
  `cedula`,
  `nombres`,
  `apellidos`,
  `correo`,
  `telefono`,
  `id_perfil`,
  `id_local`,
  `password_hash`,
  `debe_cambiar_password`,
  `intentos_fallidos`,
  `bloqueado`,
  `activo`,
  `ultimo_acceso`,
  `fecha_creacion`
) VALUES (
  '1712345678',
  'Administrador',
  'Principal',
  'admin@lfhomedecor.com',
  '0999999999',
  @perfil_admin_id,
  @local_matriz_id,
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
  `id_perfil` = @perfil_admin_id,
  `id_local` = @local_matriz_id,
  `debe_cambiar_password` = 0,
  `intentos_fallidos` = 0,
  `bloqueado` = 0,
  `activo` = 1;
