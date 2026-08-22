# Migraciones RLS

Las migraciones de esta carpeta deben ejecutarse desde Supabase CLI o el SQL
Editor del proyecto correcto. No se ejecutan automáticamente desde Next.js.

La migracion `20260820000000_fase12_rls_usuarios.sql` protege `public.usuarios`
sin conceder `SELECT` a `anon` y sin permitir escrituras directas a usuarios no
administradores.

La migracion `20260821000000_grant_usuarios_service_role.sql` concede solamente
`SELECT`, `INSERT` y `UPDATE` a `service_role`, necesarios para resolver la
cedula, crear usuarios internos y registrar intentos/accesos desde acciones
exclusivamente server-side. No concede privilegios a `anon` ni desactiva RLS.
El `INSERT` de `auditoria` y el uso de su secuencia permiten que el trigger de
auditoria de `usuarios` registre esos cambios administrativos.
Los `SELECT` de `perfiles`, `perfil_permisos` y `permisos` permiten construir
el contexto de autorizacion server-side despues de validar la sesion.

La migracion `20260822000000_fase12_rls_operaciones.sql` completa la cobertura
RLS inicial de productos/variantes, stock/movimientos, ventas/detalles/pagos y
auditoria. Las policies consultan perfiles y permisos reales; Asesor ve sólo sus
ventas y Venta Local sólo las de su local. El stock no admite escrituras directas
del rol `authenticated`, y el procedimiento de movimientos queda reservado al
servidor para impedir la suplantacion de `p_usuario`.

Después de aplicar las migraciones, ejecutar
`supabase/tests/fase12_rls_verification.sql`. El bloque falla explícitamente si
alguna tabla queda sin RLS/policies, si `anon` conserva privilegios o si las
funciones y vistas críticas pueden evadir la seguridad esperada.

La migracion `20260823000000_fase19_auditoria.sql` instala un unico trigger
idempotente en cada tabla operativa. Registra `INSERT`, `UPDATE` y `DELETE` con
la fila anterior/nueva y resuelve el usuario cuando la operacion usa una sesion
autenticada. Los eventos `LOGIN`, `LOGOUT` y `CAMBIO_PASSWORD` se escriben desde
acciones server-side sin guardar contrasenas, tokens ni secretos. Verificar con
`supabase/tests/fase19_auditoria_verification.sql`; la prueba hace `ROLLBACK`.

Antes de aplicar las migraciones, confirmar que `public.perfiles.nombre` es la
columna que contiene el nombre del perfil.

## Seed de datos maestros

`supabase/seed.sql` contiene únicamente datos maestros de Fase 41. Es idempotente,
no crea cuentas ni contraseñas y no incluye productos ficticios. Supabase CLI lo
ejecuta automáticamente después de las migraciones durante `supabase db reset`.
En un proyecto remoto también puede ejecutarse desde SQL Editor. Después se puede
validar con `supabase/tests/fase41_seed_verification.sql`.

Los productos ficticios de Fase 42 están separados en
`supabase/seeds/fase42_test_data.sql` y no forman parte de `db reset`. El archivo
se bloquea salvo que exista el parámetro `ENTORNO` con un valor explícitamente no
productivo. `supabase/seeds/fase42_cleanup.sql` elimina solamente los registros
marcados con `[FASE42_TEST]`.
