-- Limpieza reversible de los productos ficticios de Fase 42.
-- También exige ENTORNO no productivo.
begin;
do $$ begin
  if not exists (select 1 from public.parametros_sistema where codigo = 'ENTORNO' and upper(trim(valor)) in ('TEST','DEVELOPMENT','DESARROLLO','LOCAL')) then
    raise exception 'SEGURIDAD: limpieza de pruebas bloqueada fuera de un entorno de prueba.';
  end if;
end;
$$;
delete from public.variantes_producto where id_producto in (select id_producto from public.productos where detalle = '[FASE42_TEST]');
delete from public.productos where detalle = '[FASE42_TEST]';
commit;
