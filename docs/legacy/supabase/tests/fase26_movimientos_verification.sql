-- Prueba estructural sin modificar existencias.
do $$
begin
  if to_regprocedure('public.sp_registrar_movimiento_inventario(bigint,bigint,character varying,numeric,bigint,text,character varying,bigint)') is null then
    raise exception 'No existe la firma endurecida del procedimiento de inventario';
  end if;
  if has_function_privilege('anon', 'public.sp_registrar_movimiento_inventario(bigint,bigint,character varying,numeric,bigint,text,character varying,bigint)', 'EXECUTE') then
    raise exception 'anon no debe ejecutar movimientos';
  end if;
  if has_function_privilege('authenticated', 'public.sp_registrar_movimiento_inventario(bigint,bigint,character varying,numeric,bigint,text,character varying,bigint)', 'EXECUTE') then
    raise exception 'authenticated no debe ejecutar movimientos directamente';
  end if;
  if not has_function_privilege('service_role', 'public.sp_registrar_movimiento_inventario(bigint,bigint,character varying,numeric,bigint,text,character varying,bigint)', 'EXECUTE') then
    raise exception 'service_role necesita EXECUTE';
  end if;
end;
$$;
