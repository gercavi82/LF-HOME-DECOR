do $$ begin
  if exists (select 1 from public.variantes_producto where codigo_interno is null) then raise exception 'Existen variantes sin código interno.'; end if;
  if exists (select codigo_interno from public.variantes_producto group by codigo_interno having count(*) > 1) then raise exception 'Existen códigos internos duplicados.'; end if;
  if exists (select codigo_gs1 from public.variantes_producto where codigo_gs1 is not null group by codigo_gs1 having count(*) > 1) then raise exception 'Existen GS1 duplicados.'; end if;
end; $$;
select 'CÓDIGOS INTERNOS Y GS1 VERIFICADOS' as resultado;
