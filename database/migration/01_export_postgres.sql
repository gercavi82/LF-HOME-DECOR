-- ==============================================================================
-- L&F HOME DECOR - FASE 11: EXPORTACIÓN DE DATOS DESDE POSTGRESQL / SUPABASE
-- Archivo: database/migration/01_export_postgres.sql
-- Ejecutar en el SQL Editor de Supabase / PostgreSQL
-- ==============================================================================

-- NOTA DE SEGURIDAD:
-- NO exportamos auth.users, tokens, sesiones ni service_role.
-- Exportamos únicamente datos de negocio funcionales.

-- 1. Catálogos Base y Control de Acceso
COPY (
  SELECT id_perfil, codigo, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.perfiles
  ORDER BY id_perfil
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_permiso, codigo, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.permisos
  ORDER BY id_permiso
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_perfil, id_permiso
  FROM public.perfil_permisos
  ORDER BY id_perfil, id_permiso
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_local, nombre, codigo, direccion, telefono, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.locales
  ORDER BY id_local
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 2. Usuarios Funcionales (Sin hashes legacy de Supabase GoTrue)
COPY (
  SELECT 
    id_usuario,
    cedula,
    nombres,
    apellidos,
    correo,
    telefono,
    id_perfil,
    id_local,
    (CASE WHEN activo THEN 1 ELSE 0 END) AS activo,
    (CASE WHEN bloqueado THEN 1 ELSE 0 END) AS bloqueado,
    ultimo_acceso,
    fecha_creacion,
    fecha_actualizacion
  FROM public.usuarios
  ORDER BY id_usuario
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 3. Catálogos de Productos
COPY (
  SELECT id_categoria, codigo, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.categorias
  ORDER BY id_categoria
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_marca, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.marcas
  ORDER BY id_marca
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_tipo, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.tipos_producto
  ORDER BY id_tipo
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_material, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.materiales
  ORDER BY id_material
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_tamano, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.tamanos
  ORDER BY id_tamano
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_color, nombre, codigo_hex, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.colores
  ORDER BY id_color
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_diseno, nombre, descripcion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.disenos
  ORDER BY id_diseno
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_unidad, codigo, nombre, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.unidades_medida
  ORDER BY id_unidad
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 4. Productos y Variantes
COPY (
  SELECT 
    id_producto, id_categoria, id_tipo, id_marca, descripcion, detalle,
    (CASE WHEN activo THEN 1 ELSE 0 END) AS activo,
    creado_por, fecha_creacion, fecha_actualizacion
  FROM public.productos
  ORDER BY id_producto
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT 
    id_variante, id_producto, codigo_interno, codigo_gs1, id_material, id_tamano,
    id_color, id_diseno, id_unidad, precio_venta, porcentaje_iva, stock_minimo,
    imagen_url, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion, fecha_actualizacion
  FROM public.variantes_producto
  ORDER BY id_variante
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 5. Bodegas, Stock y Movimientos
COPY (
  SELECT id_bodega, id_local, nombre, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.bodegas
  ORDER BY id_bodega
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_stock, id_variante, id_bodega, cantidad, fecha_actualizacion
  FROM public.stock_producto
  ORDER BY id_stock
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT 
    id_movimiento, id_variante, id_bodega, tipo, cantidad, stock_anterior,
    stock_nuevo, motivo, referencia_tipo, referencia_id, usuario, fecha
  FROM public.movimientos_inventario
  ORDER BY id_movimiento
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 6. Clientes, Canales y Formas de Pago
COPY (
  SELECT 
    id_cliente, identificacion, nombres, apellidos, razon_social, correo,
    telefono, direccion, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo, fecha_creacion
  FROM public.clientes
  ORDER BY id_cliente
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_forma_pago, codigo, nombre, (CASE WHEN requiere_referencia THEN 1 ELSE 0 END) AS requiere_referencia, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo
  FROM public.formas_pago
  ORDER BY id_forma_pago
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_canal, codigo, nombre, (CASE WHEN activo THEN 1 ELSE 0 END) AS activo
  FROM public.canales_venta
  ORDER BY id_canal
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 7. Ventas, Detalle y Pagos
COPY (
  SELECT 
    id_venta, numero_venta, id_local, id_cliente, id_canal, id_usuario,
    fecha, subtotal, descuento, iva, total, observaciones, estado
  FROM public.ventas
  ORDER BY id_venta
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT 
    id_detalle, id_venta, id_variante, cantidad, precio_unitario,
    descuento, porcentaje_iva, subtotal, iva, total
  FROM public.detalle_ventas
  ORDER BY id_detalle
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_pago, id_venta, id_forma_pago, valor, referencia, fecha
  FROM public.pagos_venta
  ORDER BY id_pago
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- 8. Auditoría y Parámetros
COPY (
  SELECT 
    id_auditoria, usuario, tabla_afectada, accion, registro_id,
    valor_anterior::text, valor_nuevo::text, fecha
  FROM public.auditoria
  ORDER BY id_auditoria
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');

COPY (
  SELECT id_parametro, codigo, valor, descripcion, tipo_dato, (CASE WHEN editable THEN 1 ELSE 0 END) AS editable, fecha_actualizacion
  FROM public.parametros_sistema
  ORDER BY id_parametro
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',');
