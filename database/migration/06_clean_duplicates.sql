-- ==============================================================================
-- L&F HOME DECOR - LIMPIEZA DE REGISTROS DUPLICADOS EN CATÁLOGOS
-- Ejecutar en phpMyAdmin para eliminar duplicados y añadir índices únicos
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. LIMPIAR DUPLICADOS EN MATERIALES
DELETE m1 FROM materiales m1
INNER JOIN materiales m2 
WHERE m1.id_material > m2.id_material 
  AND TRIM(LOWER(m1.nombre)) = TRIM(LOWER(m2.nombre));

-- 2. LIMPIAR DUPLICADOS EN CATEGORÍAS
DELETE c1 FROM categorias c1
INNER JOIN categorias c2 
WHERE c1.id_categoria > c2.id_categoria 
  AND TRIM(LOWER(c1.nombre)) = TRIM(LOWER(c2.nombre));

-- 3. LIMPIAR DUPLICADOS EN MARCAS
DELETE m1 FROM marcas m1
INNER JOIN marcas m2 
WHERE m1.id_marca > m2.id_marca 
  AND TRIM(LOWER(m1.nombre)) = TRIM(LOWER(m2.nombre));

-- 4. LIMPIAR DUPLICADOS EN TIPOS DE PRODUCTO
DELETE t1 FROM tipos_producto t1
INNER JOIN tipos_producto t2 
WHERE t1.id_tipo > t2.id_tipo 
  AND TRIM(LOWER(t1.nombre)) = TRIM(LOWER(t2.nombre));

-- 5. LIMPIAR DUPLICADOS EN TAMAÑOS
DELETE t1 FROM tamanos t1
INNER JOIN tamanos t2 
WHERE t1.id_tamano > t2.id_tamano 
  AND TRIM(LOWER(t1.nombre)) = TRIM(LOWER(t2.nombre));

-- 6. LIMPIAR DUPLICADOS EN COLORES
DELETE c1 FROM colores c1
INNER JOIN colores c2 
WHERE c1.id_color > c2.id_color 
  AND TRIM(LOWER(c1.nombre)) = TRIM(LOWER(c2.nombre));

-- 7. LIMPIAR DUPLICADOS EN DISEÑOS
DELETE d1 FROM disenos d1
INNER JOIN disenos d2 
WHERE d1.id_diseno > d2.id_diseno 
  AND TRIM(LOWER(d1.nombre)) = TRIM(LOWER(d2.nombre));

-- 8. LIMPIAR DUPLICADOS EN UNIDADES DE MEDIDA
DELETE u1 FROM unidades_medida u1
INNER JOIN unidades_medida u2 
WHERE u1.id_unidad > u2.id_unidad 
  AND TRIM(LOWER(u1.nombre)) = TRIM(LOWER(u2.nombre));

SET FOREIGN_KEY_CHECKS = 1;
