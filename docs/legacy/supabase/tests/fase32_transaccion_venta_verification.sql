-- Prueba estructural; no crea ventas ni modifica inventario.
do $$
declare
  v_function text := 'public.sp_registrar_venta(bigint,bigint,bigint,bigint,numeric,jsonb,jsonb,text)';
begin
  if to_regprocedure(v_function) is null then
    raise exception 'No existe sp_registrar_venta con la firma esperada';
  end if;
  if has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'anon no debe ejecutar la transaccion de venta';
  end if;
  if has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'authenticated no debe ejecutar la transaccion directamente';
  end if;
  if not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'service_role necesita EXECUTE sobre la transaccion';
  end if;
end;
$$;
