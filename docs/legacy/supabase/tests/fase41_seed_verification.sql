-- Verificación Fase 41 sin dependencias externas como pgTAP.
-- Cada incumplimiento genera una excepción y detiene la ejecución.

do $$
begin
  if (select count(*) from public.perfiles where codigo in ('ADMINISTRADOR','VENTA_LOCAL','ASESOR') and activo) <> 3 then
    raise exception 'Fase 41: faltan perfiles iniciales activos.';
  end if;
  if (select count(*) from public.categorias where activo) < 6 then
    raise exception 'Fase 41: faltan categorías iniciales.';
  end if;
  if (select count(*) from public.marcas where activo) < 2 then
    raise exception 'Fase 41: faltan marcas iniciales.';
  end if;
  if (select count(*) from public.materiales where activo) < 6 then
    raise exception 'Fase 41: faltan materiales iniciales.';
  end if;
  if (select count(*) from public.tamanos where activo) < 6 then
    raise exception 'Fase 41: faltan tamaños iniciales.';
  end if;
  if (select count(*) from public.formas_pago where activo) < 6 then
    raise exception 'Fase 41: faltan formas de pago.';
  end if;
  if (select count(*) from public.canales_venta where activo) < 7 then
    raise exception 'Fase 41: faltan canales de venta.';
  end if;
  if (select count(*) from public.parametros_sistema where codigo in ('IVA_PORCENTAJE','ALERTA_STOCK','COMISION_ASESOR','COMISION_LOCAL')) <> 4 then
    raise exception 'Fase 41: faltan parámetros iniciales.';
  end if;
  if not exists (
    select 1 from public.perfil_permisos pp
    join public.perfiles p using (id_perfil)
    where p.codigo = 'ADMINISTRADOR'
  ) then
    raise exception 'Fase 41: el Administrador no tiene permisos asignados.';
  end if;
end;
$$;

select
  'FASE 41 VERIFICADA CORRECTAMENTE' as resultado,
  (select count(*) from public.perfiles where codigo in ('ADMINISTRADOR','VENTA_LOCAL','ASESOR')) as perfiles,
  (select count(*) from public.categorias where activo) as categorias,
  (select count(*) from public.marcas where activo) as marcas,
  (select count(*) from public.materiales where activo) as materiales,
  (select count(*) from public.tamanos where activo) as tamanos,
  (select count(*) from public.formas_pago where activo) as formas_pago,
  (select count(*) from public.canales_venta where activo) as canales;
