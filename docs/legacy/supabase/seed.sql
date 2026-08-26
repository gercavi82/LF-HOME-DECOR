-- Fase 41: datos maestros iniciales.
-- Idempotente: no incluye usuarios, credenciales ni datos ficticios de Fase 42.

begin;

insert into public.perfiles (codigo, nombre, descripcion, activo)
select seed.codigo, seed.nombre, seed.descripcion, true
from (values
  ('ADMINISTRADOR', 'Administrador', 'Acceso total al sistema'),
  ('VENTA_LOCAL', 'Venta Local', 'Operación comercial e inventario del local asignado'),
  ('ASESOR', 'Asesor', 'Consulta de productos y registro de sus propias ventas')
) as seed(codigo, nombre, descripcion)
where not exists (select 1 from public.perfiles current where upper(trim(current.codigo)) = seed.codigo);

update public.perfiles set activo = true
where codigo in ('ADMINISTRADOR', 'VENTA_LOCAL', 'ASESOR');

insert into public.categorias (codigo, nombre, descripcion, activo)
select seed.codigo, seed.nombre, seed.descripcion, true
from (values
  ('SAB', 'Sábanas', 'Juegos de sábanas y piezas individuales'),
  ('EDR', 'Edredones', 'Edredones y rellenos para dormitorio'),
  ('COB', 'Cobertores', 'Cobertores y mantas'),
  ('ALM', 'Almohadas', 'Almohadas y complementos'),
  ('PRO', 'Protectores', 'Protectores de colchón y almohada'),
  ('TOA', 'Toallas', 'Toallas y textiles de baño')
) as seed(codigo, nombre, descripcion)
where not exists (select 1 from public.categorias current where upper(trim(current.codigo)) = seed.codigo);

insert into public.marcas (nombre, descripcion, activo)
select seed.nombre, seed.descripcion, true
from (values
  ('L&F Home Decor', 'Marca principal de la empresa'),
  ('Genérica', 'Productos sin marca comercial específica')
) as seed(nombre, descripcion)
where not exists (select 1 from public.marcas current where lower(trim(current.nombre)) = lower(seed.nombre));

insert into public.materiales (nombre, descripcion, activo)
select seed.nombre, seed.descripcion, true
from (values
  ('Algodón', 'Fibra natural de algodón'),
  ('Microfibra', 'Tejido sintético de microfibra'),
  ('Sherpa', 'Tejido térmico tipo sherpa'),
  ('Viscoelástica', 'Espuma viscoelástica'),
  ('Poliéster', 'Fibra sintética de poliéster'),
  ('Impermeable', 'Material con protección contra líquidos')
) as seed(nombre, descripcion)
where not exists (select 1 from public.materiales current where lower(trim(current.nombre)) = lower(seed.nombre));

insert into public.tamanos (nombre, descripcion, activo)
select seed.nombre, seed.descripcion, true
from (values
  ('Individual', 'Tamaño individual'),
  ('1 1/2 Plazas', 'Tamaño de plaza y media'),
  ('2 Plazas', 'Tamaño matrimonial de dos plazas'),
  ('Queen', 'Tamaño Queen'),
  ('King', 'Tamaño King'),
  ('Estándar', 'Tamaño estándar para complementos')
) as seed(nombre, descripcion)
where not exists (select 1 from public.tamanos current where lower(trim(current.nombre)) = lower(seed.nombre));

insert into public.formas_pago (codigo, nombre, requiere_referencia, activo)
values
  ('EFECTIVO', 'Efectivo', false, true),
  ('TRANSFERENCIA', 'Transferencia', true, true),
  ('TARJETA', 'Tarjeta', true, true),
  ('DEUNA', 'DeUna', true, true),
  ('MIXTO', 'Mixto', false, true),
  ('CREDITO_INTERNO', 'Crédito interno', false, true)
on conflict (codigo) do update set nombre = excluded.nombre, requiere_referencia = excluded.requiere_referencia, activo = true;

insert into public.canales_venta (codigo, nombre, activo)
values
  ('LOCAL', 'Local', true),
  ('ASESOR', 'Asesor', true),
  ('WHATSAPP', 'WhatsApp', true),
  ('FACEBOOK', 'Facebook', true),
  ('INSTAGRAM', 'Instagram', true),
  ('TIKTOK', 'TikTok', true),
  ('OTROS', 'Otros', true)
on conflict (codigo) do update set nombre = excluded.nombre, activo = true;

insert into public.parametros_sistema (codigo, valor, descripcion, tipo_dato, editable)
values
  ('IVA_PORCENTAJE', '15', 'Porcentaje de IVA aplicado a nuevos productos', 'NUMERIC', true),
  ('ALERTA_STOCK', '5', 'Cantidad predeterminada para alerta de stock', 'NUMERIC', true),
  ('COMISION_ASESOR', '60', 'Porcentaje de participación del asesor', 'NUMERIC', true),
  ('COMISION_LOCAL', '40', 'Porcentaje de participación del local', 'NUMERIC', true)
on conflict (codigo) do nothing;

-- Administrador recibe todos los permisos existentes y futuros al volver a ejecutar el seed.
insert into public.perfil_permisos (id_perfil, id_permiso)
select profile.id_perfil, permission.id_permiso
from public.perfiles profile cross join public.permisos permission
where profile.codigo = 'ADMINISTRADOR' and permission.activo
on conflict do nothing;

insert into public.perfil_permisos (id_perfil, id_permiso)
select profile.id_perfil, permission.id_permiso
from public.perfiles profile join public.permisos permission on permission.codigo = any(array[
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'INVENTARIO_AJUSTAR', 'VENTA_VER', 'VENTA_CREAR'
])
where profile.codigo = 'VENTA_LOCAL' and permission.activo
on conflict do nothing;

insert into public.perfil_permisos (id_perfil, id_permiso)
select profile.id_perfil, permission.id_permiso
from public.perfiles profile join public.permisos permission on permission.codigo = any(array[
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'VENTA_VER', 'VENTA_CREAR'
])
where profile.codigo = 'ASESOR' and permission.activo
on conflict do nothing;

commit;
