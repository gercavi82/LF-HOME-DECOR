-- ==============================================================================
-- RESTAURACIÓN Y DESBLOQUEO DEL USUARIO ADMINISTRADOR PRINCIPAL
-- Ejecute este script en phpMyAdmin o consola MySQL para restaurar el acceso.
-- ==============================================================================

-- 1. Asegurar que existe el perfil ADMINISTRADOR con todos los permisos
INSERT INTO `perfiles` (`id_perfil`, `codigo`, `nombre`, `descripcion`, `activo`)
VALUES (1, 'ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1)
ON DUPLICATE KEY UPDATE `nombre` = 'Administrador', `activo` = 1;

-- Asignar todos los permisos al perfil 1
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT 1, id_permiso FROM `permisos` WHERE `activo` = 1;

-- 2. Asegurar que existe el Local Matriz
INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`)
VALUES (1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE `activo` = 1;

-- 3. Limpiar bloqueos de intentos fallidos y rate limit
DELETE FROM `auth_rate_limits`;

-- 4. Crear o Restaurar el Usuario Administrador
-- Contraseña temporal establecida: Admin1234*  (Hash: $2b$12$NRVt61lcOMDBylkKRVEVeO7C1WXOd6fkn36t5pDaJLsntFRf4f.1u)
-- Cédula de acceso: 1712345678
INSERT INTO `usuarios` (
  `id_usuario`,
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
  1,
  '1712345678',
  'Administrador',
  'Principal',
  'admin@mihogaryconfort.com',
  '0999999999',
  1,
  1,
  '$2b$12$NRVt61lcOMDBylkKRVEVeO7C1WXOd6fkn36t5pDaJLsntFRf4f.1u',
  0,
  0,
  0,
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `cedula` = '1712345678',
  `nombres` = 'Administrador',
  `apellidos` = 'Principal',
  `id_perfil` = 1,
  `id_local` = 1,
  `password_hash` = '$2b$12$NRVt61lcOMDBylkKRVEVeO7C1WXOd6fkn36t5pDaJLsntFRf4f.1u',
  `debe_cambiar_password` = 0,
  `intentos_fallidos` = 0,
  `bloqueado` = 0,
  `activo` = 1;

-- Comprobar estado final del usuario
SELECT id_usuario, cedula, nombres, apellidos, id_perfil, activo, bloqueado, intentos_fallidos FROM usuarios WHERE id_usuario = 1 OR cedula = '1712345678';
