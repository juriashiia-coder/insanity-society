-- Ejecuta esto DESPUÉS de crear tu usuario en Authentication > Users.
-- Cambia el correo por el que usaste al crear el usuario.
insert into public.admins (user_id)
select id from auth.users where email = 'TU-CORREO@ejemplo.com'
on conflict do nothing;

-- Comprobación: debe mostrar tu correo
select u.email from public.admins a join auth.users u on u.id = a.user_id;
