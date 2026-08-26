-- ==============================================================================
-- TABLA DE SESIONES DE USUARIO (agregar a full_database_setup.sql)
-- ==============================================================================
-- Ejecutar en phpMyAdmin después del setup principal, o agregarlo al script.

CREATE TABLE IF NOT EXISTS `sesiones_usuario` (
  `id_sesion` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario` BIGINT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_expiracion` DATETIME NOT NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `revocada` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_sesion_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
  INDEX `idx_sesion_usuario` (`id_usuario`),
  INDEX `idx_sesion_expiracion` (`fecha_expiracion`),
  INDEX `idx_sesion_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
