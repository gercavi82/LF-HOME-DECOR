-- ==============================================================================
-- L&F HOME DECOR - STORED PROCEDURES & TRIGGERS MARIADB / MYSQL
-- ==============================================================================

DELIMITER $$

-- ------------------------------------------------------------------------------
-- 1. CONTROL DE RATE LIMIT EN LOGIN
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_controlar_limite_login`$$
CREATE PROCEDURE `sp_controlar_limite_login`(
  IN `p_clave_hash` VARCHAR(64),
  IN `p_operacion` VARCHAR(20),
  OUT `p_permitido` TINYINT(1),
  OUT `p_reintentar_en` INT
)
BEGIN
  DECLARE v_intentos INT DEFAULT 0;
  DECLARE v_ventana_inicio DATETIME;
  DECLARE v_bloqueado_hasta DATETIME;
  DECLARE v_ahora DATETIME DEFAULT NOW();
  
  SET p_permitido = 1;
  SET p_reintentar_en = 0;

  IF p_operacion NOT IN ('CHECK', 'FAILURE', 'SUCCESS') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operación de control inválida.';
  END IF;

  IF p_operacion = 'SUCCESS' THEN
    DELETE FROM auth_rate_limits WHERE clave_hash = p_clave_hash;
  ELSE
    INSERT IGNORE INTO auth_rate_limits (clave_hash, intentos, ventana_inicio, actualizado_en)
    VALUES (p_clave_hash, 0, v_ahora, v_ahora);

    SELECT intentos, ventana_inicio, bloqueado_hasta
    INTO v_intentos, v_ventana_inicio, v_bloqueado_hasta
    FROM auth_rate_limits WHERE clave_hash = p_clave_hash FOR UPDATE;

    IF v_bloqueado_hasta IS NOT NULL AND v_bloqueado_hasta > v_ahora THEN
      SET p_permitido = 0;
      SET p_reintentar_en = TIMESTAMPDIFF(SECOND, v_ahora, v_bloqueado_hasta);
    ELSE
      IF v_ventana_inicio < DATE_SUB(v_ahora, INTERVAL 15 MINUTE) THEN
        SET v_intentos = 0;
        SET v_ventana_inicio = v_ahora;
        SET v_bloqueado_hasta = NULL;
        UPDATE auth_rate_limits
        SET intentos = 0, ventana_inicio = v_ahora, bloqueado_hasta = NULL, actualizado_en = v_ahora
        WHERE clave_hash = p_clave_hash;
      END IF;

      IF p_operacion = 'FAILURE' THEN
        SET v_intentos = v_intentos + 1;
        IF v_intentos >= 10 THEN
          SET v_bloqueado_hasta = DATE_ADD(v_ahora, INTERVAL 15 MINUTE);
          SET p_permitido = 0;
          SET p_reintentar_en = 900;
        END IF;
        UPDATE auth_rate_limits
        SET intentos = v_intentos, bloqueado_hasta = v_bloqueado_hasta, actualizado_en = v_ahora
        WHERE clave_hash = p_clave_hash;
      END IF;
    END IF;
  END IF;
END$$

-- ------------------------------------------------------------------------------
-- 2. REGISTRO ATÓMICO DE MOVIMIENTO DE INVENTARIO
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_movimiento_inventario`$$
CREATE PROCEDURE `sp_registrar_movimiento_inventario`(
  IN `p_variante` BIGINT,
  IN `p_bodega` INT,
  IN `p_tipo` VARCHAR(50),
  IN `p_cantidad` DECIMAL(12,2),
  IN `p_usuario` BIGINT,
  IN `p_motivo` TEXT,
  IN `p_referencia_tipo` VARCHAR(50),
  IN `p_referencia_id` BIGINT,
  OUT `p_movimiento_id` BIGINT
)
BEGIN
  DECLARE v_tipo VARCHAR(50);
  DECLARE v_stock_id BIGINT;
  DECLARE v_stock_anterior DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_stock_nuevo DECIMAL(12,2);
  DECLARE v_factor INT;
  DECLARE v_exists INT;

  SET v_tipo = UPPER(TRIM(p_tipo));

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad debe ser mayor que cero.';
  END IF;

  IF v_tipo NOT IN ('ENTRADA_INICIAL','COMPRA','VENTA','DEVOLUCION_COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tipo de movimiento no permitido.';
  END IF;

  IF v_tipo IN ('ENTRADA_INICIAL','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') AND (p_motivo IS NULL OR TRIM(p_motivo) = '') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El motivo es obligatorio para ajustes manuales.';
  END IF;

  SELECT COUNT(*) INTO v_exists FROM variantes_producto WHERE id_variante = p_variante AND activo = 1;
  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La variante no existe o está inactiva.';
  END IF;

  SELECT COUNT(*) INTO v_exists FROM bodegas WHERE id_bodega = p_bodega AND activo = 1;
  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bodega no existe o está inactiva.';
  END IF;

  IF p_usuario IS NOT NULL THEN
    SELECT COUNT(*) INTO v_exists FROM usuarios WHERE id_usuario = p_usuario AND activo = 1 AND bloqueado = 0;
    IF v_exists = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario no está autorizado o está bloqueado.';
    END IF;
  END IF;

  SET v_factor = CASE WHEN v_tipo IN ('ENTRADA_INICIAL','COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','CORRECCION_ENTRADA') THEN 1 ELSE -1 END;

  SELECT id_stock, cantidad INTO v_stock_id, v_stock_anterior
  FROM stock_producto WHERE id_variante = p_variante AND id_bodega = p_bodega FOR UPDATE;

  IF v_stock_id IS NULL THEN
    IF v_factor < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe stock disponible para realizar la salida.';
    END IF;
    INSERT INTO stock_producto (id_variante, id_bodega, cantidad)
    VALUES (p_variante, p_bodega, 0.00);
    SET v_stock_id = LAST_INSERT_ID();
    SET v_stock_anterior = 0.00;
  END IF;

  SET v_stock_nuevo = v_stock_anterior + (p_cantidad * v_factor);
  IF v_stock_nuevo < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente.';
  END IF;

  UPDATE stock_producto SET cantidad = v_stock_nuevo WHERE id_stock = v_stock_id;

  INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario, fecha)
  VALUES (p_variante, p_bodega, v_tipo, p_cantidad, v_stock_anterior, v_stock_nuevo, NULLIF(TRIM(p_motivo), ''), NULLIF(TRIM(p_referencia_tipo), ''), p_referencia_id, p_usuario, NOW());

  SET p_movimiento_id = LAST_INSERT_ID();
END$$

-- ------------------------------------------------------------------------------
-- 3. REGISTRO TRANSACCIONAL COMPLETO DE VENTA
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_venta`$$
CREATE PROCEDURE `sp_registrar_venta`(
  IN `p_local` INT,
  IN `p_cliente` BIGINT,
  IN `p_canal` INT,
  IN `p_usuario` BIGINT,
  IN `p_descuento` DECIMAL(12,2),
  IN `p_items` JSON,
  IN `p_pagos` JSON,
  IN `p_observaciones` TEXT,
  OUT `p_id_venta` BIGINT,
  OUT `p_numero_venta` VARCHAR(50),
  OUT `p_total` DECIMAL(12,2)
)
proc_label: BEGIN
  DECLARE v_total_items INT DEFAULT 0;
  DECLARE v_total_pagos INT DEFAULT 0;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_descuento DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_descuento_asignado DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_bruto DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_subtotal DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_iva DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_total DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_pago_total DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_numero VARCHAR(50);
  DECLARE v_sale_id BIGINT;
  DECLARE v_mov_id BIGINT;

  -- Variables para iterar items
  DECLARE v_item_var_id BIGINT;
  DECLARE v_item_cant DECIMAL(12,2);
  DECLARE v_item_precio DECIMAL(12,2);
  DECLARE v_item_iva_porc DECIMAL(5,2);
  DECLARE v_linea_bruta DECIMAL(12,2);
  DECLARE v_linea_descuento DECIMAL(12,2);
  DECLARE v_linea_total DECIMAL(12,2);
  DECLARE v_linea_subtotal DECIMAL(12,2);
  DECLARE v_linea_iva DECIMAL(12,2);
  DECLARE v_restante DECIMAL(12,2);
  DECLARE v_tomar DECIMAL(12,2);

  -- Variables para iterar pagos
  DECLARE v_pago_forma_id INT;
  DECLARE v_pago_valor DECIMAL(12,2);
  DECLARE v_pago_ref VARCHAR(150);
  DECLARE v_forma_codigo VARCHAR(50);
  DECLARE v_forma_req_ref TINYINT(1);

  -- Cursor para bodegas con stock
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_cur_bodega INT;
  DECLARE v_cur_cant DECIMAL(12,2);
  DECLARE cur_stock CURSOR FOR 
    SELECT sp.id_bodega, sp.cantidad 
    FROM stock_producto sp 
    JOIN bodegas b ON b.id_bodega = sp.id_bodega 
    WHERE sp.id_variante = v_item_var_id AND b.id_local = p_local AND b.activo = 1 AND sp.cantidad > 0 
    ORDER BY sp.cantidad DESC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SET v_total_items = JSON_LENGTH(p_items);
  SET v_total_pagos = JSON_LENGTH(p_pagos);
  SET v_descuento = COALESCE(p_descuento, 0.00);

  IF v_total_items IS NULL OR v_total_items = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta debe contener al menos un producto.';
  END IF;
  IF v_total_pagos IS NULL OR v_total_pagos = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta debe contener al menos una forma de pago.';
  END IF;
  IF v_descuento < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento no puede ser negativo.';
  END IF;

  -- 1. Calcular total bruto de la venta
  SET v_i = 0;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    IF v_item_cant <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad de producto debe ser mayor a cero.';
    END IF;

    SELECT vp.precio_venta, vp.porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto vp
    JOIN productos p ON p.id_producto = vp.id_producto
    WHERE vp.id_variante = v_item_var_id AND vp.activo = 1 AND p.activo = 1;

    IF v_item_precio IS NULL OR v_item_precio <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Producto no disponible o precio inválido.';
    END IF;

    SET v_bruto = v_bruto + ROUND(v_item_precio * v_item_cant, 2);
    SET v_i = v_i + 1;
  END WHILE;

  IF v_descuento > v_bruto THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento no puede superar el valor total de la venta.';
  END IF;

  SET v_total = v_bruto - v_descuento;

  -- 2. Validar pagos
  SET v_i = 0;
  WHILE v_i < v_total_pagos DO
    SET v_pago_forma_id = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].id_forma_pago')));
    SET v_pago_valor = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].valor'))) AS DECIMAL(12,2));
    SET v_pago_ref = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].referencia')));

    SELECT codigo, requiere_referencia INTO v_forma_codigo, v_forma_req_ref
    FROM formas_pago WHERE id_forma_pago = v_pago_forma_id AND activo = 1;

    IF v_forma_codigo IS NULL OR v_pago_valor <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Forma de pago o valor inválido.';
    END IF;
    IF v_forma_codigo = 'MIXTO' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mixto debe desglosarse en formas de pago individuales.';
    END IF;
    IF v_forma_req_ref = 1 AND (v_pago_ref IS NULL OR CHAR_LENGTH(TRIM(v_pago_ref)) < 3) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La referencia de pago es obligatoria.';
    END IF;

    SET v_pago_total = v_pago_total + ROUND(v_pago_valor, 2);
    SET v_i = v_i + 1;
  END WHILE;

  IF ROUND(v_pago_total, 2) <> v_total THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La suma de pagos no coincide con el total de la venta.';
  END IF;

  -- 3. Calcular desglose de subtotales e impuestos
  SET v_i = 0;
  SET v_descuento_asignado = 0.00;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    SELECT precio_venta, porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto WHERE id_variante = v_item_var_id;

    SET v_linea_bruta = ROUND(v_item_precio * v_item_cant, 2);
    IF (v_i + 1) = v_total_items THEN
      SET v_linea_descuento = v_descuento - v_descuento_asignado;
    ELSE
      SET v_linea_descuento = ROUND(v_descuento * (v_linea_bruta / NULLIF(v_bruto, 0)), 2);
    END IF;
    SET v_descuento_asignado = v_descuento_asignado + v_linea_descuento;
    SET v_linea_total = v_linea_bruta - v_linea_descuento;
    SET v_linea_subtotal = ROUND(v_linea_total / (1 + (v_item_iva_porc / 100)), 2);
    SET v_linea_iva = v_linea_total - v_linea_subtotal;

    SET v_subtotal = v_subtotal + v_linea_subtotal;
    SET v_iva = v_iva + v_linea_iva;
    SET v_i = v_i + 1;
  END WHILE;

  IF (v_subtotal + v_iva) <> v_total THEN
    SET v_iva = v_total - v_subtotal;
  END IF;

  -- 4. Insertar cabecera de venta
  SET v_numero = CONCAT('V-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 6)));

  INSERT INTO ventas (numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, subtotal, descuento, iva, total, observaciones, estado)
  VALUES (v_numero, p_local, p_cliente, p_canal, p_usuario, NOW(), v_subtotal, v_descuento, v_iva, v_total, NULLIF(TRIM(p_observaciones), ''), 'REGISTRADA');
  SET v_sale_id = LAST_INSERT_ID();

  -- 5. Insertar detalles y descontar stock
  SET v_i = 0;
  SET v_descuento_asignado = 0.00;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    SELECT precio_venta, porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto WHERE id_variante = v_item_var_id;

    SET v_linea_bruta = ROUND(v_item_precio * v_item_cant, 2);
    IF (v_i + 1) = v_total_items THEN
      SET v_linea_descuento = v_descuento - v_descuento_asignado;
    ELSE
      SET v_linea_descuento = ROUND(v_descuento * (v_linea_bruta / NULLIF(v_bruto, 0)), 2);
    END IF;
    SET v_descuento_asignado = v_descuento_asignado + v_linea_descuento;
    SET v_linea_total = v_linea_bruta - v_linea_descuento;
    SET v_linea_subtotal = ROUND(v_linea_total / (1 + (v_item_iva_porc / 100)), 2);
    SET v_linea_iva = v_linea_total - v_linea_subtotal;

    INSERT INTO detalle_ventas (id_venta, id_variante, cantidad, precio_unitario, descuento, porcentaje_iva, subtotal, iva, total)
    VALUES (v_sale_id, v_item_var_id, v_item_cant, v_item_precio, v_linea_descuento, v_item_iva_porc, v_linea_subtotal, v_linea_iva, v_linea_total);

    -- Descontar inventario de bodegas del local
    SET v_restante = v_item_cant;
    SET done = FALSE;
    OPEN cur_stock;
    read_loop: LOOP
      FETCH cur_stock INTO v_cur_bodega, v_cur_cant;
      IF done OR v_restante <= 0 THEN
        LEAVE read_loop;
      END IF;
      SET v_tomar = LEAST(v_restante, v_cur_cant);
      CALL sp_registrar_movimiento_inventario(v_item_var_id, v_cur_bodega, 'VENTA', v_tomar, p_usuario, CONCAT('Venta ', v_numero), 'VENTA', v_sale_id, v_mov_id);
      SET v_restante = v_restante - v_tomar;
    END LOOP;
    CLOSE cur_stock;

    IF v_restante > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente en el local para completar la venta.';
    END IF;

    SET v_i = v_i + 1;
  END WHILE;

  -- 6. Insertar pagos
  SET v_i = 0;
  WHILE v_i < v_total_pagos DO
    SET v_pago_forma_id = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].id_forma_pago')));
    SET v_pago_valor = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].valor'))) AS DECIMAL(12,2));
    SET v_pago_ref = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].referencia')));

    INSERT INTO pagos_venta (id_venta, id_forma_pago, valor, referencia, fecha)
    VALUES (v_sale_id, v_pago_forma_id, ROUND(v_pago_valor, 2), NULLIF(TRIM(v_pago_ref), ''), NOW());
    SET v_i = v_i + 1;
  END WHILE;

  SET p_id_venta = v_sale_id;
  SET p_numero_venta = v_numero;
  SET p_total = v_total;
END$$

-- ------------------------------------------------------------------------------
-- 4. TRIGGER: AUTOGENERACIÓN DE CÓDIGO INTERNO
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_codigo_interno_producto`$$
CREATE TRIGGER `trg_codigo_interno_producto`
BEFORE INSERT ON `variantes_producto`
FOR EACH ROW
BEGIN
  DECLARE v_cat_cod VARCHAR(20);
  DECLARE v_tipo INT;
  DECLARE v_seq INT;

  IF NEW.codigo_interno IS NULL OR TRIM(NEW.codigo_interno) = '' THEN
    SELECT COALESCE(c.codigo, 'CAT'), p.id_tipo INTO v_cat_cod, v_tipo
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE p.id_producto = NEW.id_producto;

    INSERT INTO secuencia_codigo_interno VALUES (NULL);
    SET v_seq = LAST_INSERT_ID();

    SET NEW.codigo_interno = CONCAT(
      LEFT(UPPER(REGEXP_REPLACE(COALESCE(v_cat_cod, 'CAT'), '[^A-Za-z0-9]', '')), 8),
      '-T', COALESCE(v_tipo, 1), '-',
      LPAD(v_seq, 6, '0')
    );
  END IF;
END$$

DELIMITER ;
