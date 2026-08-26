begin;

do $$
declare
  v_subtotal numeric;
  v_iva numeric;
  v_total numeric;
begin
  select subtotal, iva, total into v_subtotal, v_iva, v_total
  from public.calcular_iva_incluido(112.00, 12.00);

  if v_subtotal <> 100.00 or v_iva <> 12.00 or v_total <> 112.00 then
    raise exception 'Calculo IVA incorrecto: subtotal %, iva %, total %', v_subtotal, v_iva, v_total;
  end if;

  if v_subtotal + v_iva <> v_total then
    raise exception 'El desglose no conserva el total';
  end if;
end;
$$;

rollback;
