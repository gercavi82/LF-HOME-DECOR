do $$
begin
  if (select count(*) from public.productos where detalle = '[FASE42_TEST]') <> 5 then raise exception 'Fase 42: deben existir exactamente 5 productos ficticios.'; end if;
  if (select count(*) from public.variantes_producto v join public.productos p using (id_producto) where p.detalle = '[FASE42_TEST]') <> 5 then raise exception 'Fase 42: cada producto ficticio debe tener una variante.'; end if;
  if exists (select 1 from public.variantes_producto v join public.productos p using (id_producto) where p.detalle = '[FASE42_TEST]' and (v.precio_venta <= 0 or v.codigo_gs1 is null)) then raise exception 'Fase 42: existen precios o GS1 inválidos.'; end if;
end;
$$;
select 'FASE 42 VERIFICADA CORRECTAMENTE' as resultado;
