-- DISTRIMAS en Dokploy: permisos para PostgREST y login con contrasenas cifradas.
-- Se corre UNA vez, despues de restaurar el respaldo de Supabase (pg_restore --no-owner --no-privileges).
-- Requiere que existan los roles anon, authenticated y service_role.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Mismos permisos que Supabase le da a la llave publica (anon)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- usuarios: desde el navegador se puede leer todo MENOS password_hash
revoke select on public.usuarios from anon, authenticated;
grant select (id, nombre, documento, telefono, usuario, perfil_id, activo, primer_ingreso, created_at)
  on public.usuarios to anon, authenticated;

-- Toda contrasena que llegue en texto plano se guarda cifrada (bcrypt)
create or replace function public.trg_usuarios_cifrar_password()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.password_hash is not null and new.password_hash !~ '^\$2[abxy]\$' then
    new.password_hash := crypt(new.password_hash, gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_cifrar_password on public.usuarios;
create trigger usuarios_cifrar_password
  before insert or update of password_hash on public.usuarios
  for each row execute function public.trg_usuarios_cifrar_password();

-- Cifrar las contrasenas que ya existen (cada usuario sigue con su misma clave)
update public.usuarios set password_hash = password_hash
where password_hash is not null and password_hash !~ '^\$2[abxy]\$';

-- Login validado en la base: devuelve el usuario con su perfil, o null
create or replace function public.login(p_usuario text, p_password text)
returns json
language sql
security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'id', u.id, 'nombre', u.nombre, 'documento', u.documento, 'telefono', u.telefono,
    'usuario', u.usuario, 'perfil_id', u.perfil_id, 'activo', u.activo,
    'primer_ingreso', u.primer_ingreso, 'created_at', u.created_at,
    'perfil', (select row_to_json(p) from perfiles p where p.id = u.perfil_id)
  )
  from usuarios u
  where u.usuario = p_usuario
    and u.activo = true
    and u.password_hash = crypt(p_password, u.password_hash)
  limit 1;
$$;

revoke execute on function public.login(text, text) from public;
grant execute on function public.login(text, text) to anon, authenticated;

-- El logo ahora vive dentro de la app
update public.configuraciones set logo_url = '/logo.png' where logo_url like '%supabase.co%';

commit;
