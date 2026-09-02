-- ==============================================================================
-- L&F HOME DECOR - ASIGNACIÓN TOTAL DE PERMISOS AL ROL SUPERVISOR
-- Ejecutar en MySQL / phpMyAdmin para activación inmediata
-- ==============================================================================

-- 1. Asegurar existencia del perfil Supervisor
INSERT INTO `perfiles` (`id_perfil`, `codigo`, `nombre`, `descripcion`, `activo`) VALUES
(2, 'SUPERVISOR', 'Supervisor', 'Supervisión operativa, control de inventario, ventas, compras y gastos', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `codigo` = 'SUPERVISOR', `descripcion` = VALUES(`descripcion`), `activo` = 1;

-- 2. Asignar todos los permisos del sistema a Administrador (1) y Supervisor (2)
INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
CROSS JOIN permisos perm
WHERE (p.codigo IN ('ADMINISTRADOR', 'SUPERVISOR') OR p.id_perfil IN (1, 2) OR p.nombre IN ('Administrador', 'Supervisor')) AND perm.activo = 1;

-- 3. Verificación de permisos asignados
SELECT 
  p.id_perfil,
  p.codigo AS perfil,
  p.nombre,
  COUNT(pp.id_permiso) AS total_permisos_asignados
FROM perfiles p
LEFT JOIN perfil_permisos pp ON pp.id_perfil = p.id_perfil
GROUP BY p.id_perfil, p.codigo, p.nombre;
