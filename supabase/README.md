# Migraciones RLS

Las migraciones de esta carpeta deben ejecutarse desde Supabase CLI o el SQL
Editor del proyecto correcto. No se ejecutan automáticamente desde Next.js.

La migracion `20260820000000_fase12_rls_usuarios.sql` protege `public.usuarios`
sin conceder `SELECT` a `anon` y sin permitir escrituras directas a usuarios no
administradores.

Antes de aplicarla, confirmar que `public.perfiles.nombre` es la columna que
contiene el nombre del perfil. Las policies de productos, ventas, inventario y
auditoria se agregaran en migraciones separadas cuando sus contratos de base de
datos esten confirmados.