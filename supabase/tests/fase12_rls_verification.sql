-- Ejecutar después de 20260822000000_fase12_rls_operaciones.sql.
-- Sólo inspecciona configuración; no modifica datos funcionales.

do $$
declare
  table_name text;
  protected_tables constant text[] := array[
    'usuarios',
    'productos',
    'variantes_producto',
    'stock_producto',
    'movimientos_inventario',
    'ventas',
    'detalle_ventas',
    'pagos_venta',
    'auditoria'
  ];
begin
  foreach table_name in array protected_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity = true
    ) then
      raise exception 'RLS no está habilitado en public.%', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
    then
      raise exception 'anon conserva privilegios sobre public.%', table_name;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
    ) then
      raise exception 'No existen policies para public.%', table_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fn_auditoria'
      and p.prosecdef = true
      and 'search_path=public, pg_temp' = any(p.proconfig)
  ) then
    raise exception 'fn_auditoria no está endurecida como SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'sp_registrar_movimiento_inventario'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'El procedimiento de inventario es ejecutable desde cliente';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'vw_dashboard_ventas',
        'vw_inventario_actual',
        'vw_productos_bajo_stock',
        'vw_productos_agotados'
      ])
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)
  ) then
    raise exception 'Existe una vista funcional sin security_invoker=true';
  end if;
end;
$$;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = any(array[
    'usuarios',
    'productos',
    'variantes_producto',
    'stock_producto',
    'movimientos_inventario',
    'ventas',
    'detalle_ventas',
    'pagos_venta',
    'auditoria'
  ])
order by tablename, policyname;
