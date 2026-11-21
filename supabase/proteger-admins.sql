-- =========================================================
-- INSANITY SOCIETY — Candado para administradores
-- Impide borrar por accidente (en Authentication > Users) a un usuario
-- que es administrador. Para borrarlo de verdad, primero quítale el
-- permiso de administrador y después sí se puede borrar.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================
create or replace function public.proteger_admins()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.admins where user_id = old.id) then
    raise exception 'No se puede borrar a % porque es administrador. Quítale primero el permiso de administrador.', old.email;
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_admins on auth.users;
create trigger proteger_admins
  before delete on auth.users
  for each row execute function public.proteger_admins();
