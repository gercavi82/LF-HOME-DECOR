begin;
select has_table('public', 'auth_rate_limits', 'Existe la tabla privada de rate limiting');
select row_security_active('public.auth_rate_limits'::regclass), 'RLS activo en rate limiting';
select function_privilege_is('anon', 'public', 'sp_controlar_limite_login', array['text','text'], array[]::text[], 'Anon no ejecuta el control');
select function_privilege_is('authenticated', 'public', 'sp_controlar_limite_login', array['text','text'], array[]::text[], 'Authenticated no ejecuta el control');
rollback;
