-- =========================================================
-- INSANITY SOCIETY — configuración de Supabase
-- Pega TODO este archivo en Supabase > SQL Editor > New query
-- y pulsa "Run". Se puede ejecutar más de una vez sin problema.
-- =========================================================

-- 1) Tabla de administradores (quién puede editar)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admin ve su propio registro" on public.admins;
create policy "admin ve su propio registro" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Función que responde "¿el usuario actual es administrador?"
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) Tabla de productos
create table if not exists public.productos (
  id            text primary key,
  nombre        text not null,
  coleccion     text not null,
  categoria     text not null default 'camiseta',
  material      text,
  tallas        text[] not null default array['S','M','L','XL'],
  colores       text[] not null default array['Negro'],
  precio        integer check (precio is null or precio >= 0),  -- null = "precio por confirmar"
  variantes     jsonb,      -- [{"nombre":"Burda","precio":140000}, ...]
  imagenes      jsonb,      -- {"Negro":{"frente":"url","espalda":"url"}}
  orden         integer not null default 0,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin new.actualizado_en = now(); return new; end; $$;
drop trigger if exists productos_actualizado on public.productos;
create trigger productos_actualizado before update on public.productos
  for each row execute function public.tocar_actualizado();

-- 3) Seguridad: todos leen lo activo; solo administradores escriben
alter table public.productos enable row level security;

drop policy if exists "lectura publica" on public.productos;
create policy "lectura publica" on public.productos
  for select to anon, authenticated using (activo or (select public.is_admin()));

drop policy if exists "admin crea" on public.productos;
create policy "admin crea" on public.productos
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "admin edita" on public.productos;
create policy "admin edita" on public.productos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin borra" on public.productos;
create policy "admin borra" on public.productos
  for delete to authenticated using ((select public.is_admin()));

grant select on public.productos to anon, authenticated;
grant insert, update, delete on public.productos to authenticated;
grant select on public.admins to authenticated;

-- 4) Fotos: bucket público para ver, solo administradores suben o borran
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "admin lista fotos" on storage.objects;
create policy "admin lista fotos" on storage.objects
  for select to authenticated using (bucket_id = 'productos' and (select public.is_admin()));

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and (select public.is_admin()));

drop policy if exists "admin actualiza fotos" on storage.objects;
create policy "admin actualiza fotos" on storage.objects
  for update to authenticated using (bucket_id = 'productos' and (select public.is_admin()));

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and (select public.is_admin()));

-- 5) Productos actuales de la tienda (no sobrescribe si ya existen)
insert into public.productos (id, nombre, coleccion, categoria, material, tallas, colores, precio, variantes, imagenes, orden, activo) values
  ('control-vs-chaos', 'Chaqueta CONTROL VS CHAOS', 'THE TRUTH BEHIND THE MASK', 'chaqueta', 'Burda', array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']::text[], array['Negro', 'Blanco', 'Gris']::text[], 217000, null, '{"Negro":{"frente":"img/productos/control-vs-chaos-negro-frente.webp","espalda":"img/productos/control-vs-chaos-negro-espalda.webp"}}'::jsonb, 10, true),
  ('untamed', 'Camiseta Oversize UNTAMED', 'THE TRUTH BEHIND THE MASK', 'camiseta', 'Qatar Premium 240 g', array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']::text[], array['Negro', 'Blanco', 'Arena', 'Rojo']::text[], 133000, null, '{"Negro":{"frente":"img/productos/untamed-negro-frente.webp"}}'::jsonb, 20, true),
  ('revelation', 'Camiseta Oversize REVELATION', 'THE TRUTH BEHIND THE MASK', 'camiseta', 'Qatar Premium 240 g', array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']::text[], array['Negro', 'Blanco', 'Arena', 'Rojo']::text[], 147000, null, '{"Negro":{"frente":"img/productos/revelation-negro-frente.webp","espalda":"img/productos/revelation-negro-espalda.webp"}}'::jsonb, 30, true),
  ('awakening', 'Camiseta Oversize AWAKENING', 'THE TRUTH BEHIND THE MASK', 'camiseta', 'Qatar Premium 240 g', array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']::text[], array['Negro']::text[], 147000, null, '{"Negro":{"frente":"img/productos/awakening-negro-frente.webp","espalda":"img/productos/awakening-negro-espalda.webp"}}'::jsonb, 40, true),
  ('path-of-masks', 'Sudadera THE PATH OF MASKS', 'THE TRUTH BEHIND THE MASK', 'sudadera', 'Qatar Premium 240 g', array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']::text[], array['Negro']::text[], 165000, null, '{"Negro":{"frente":"img/productos/path-of-masks-negro-frente.webp"}}'::jsonb, 50, true),
  ('dark-rebirth-1', 'Camiseta Oversize DARK REBIRTH I', 'DARK REBIRTH', 'camiseta', 'Qatar Premium 240 g · también en Acid Wash', array['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']::text[], array['Negro']::text[], 140000, null, '{"Negro":{"frente":"img/productos/dark-rebirth-1-negro-frente.webp","espalda":"img/productos/dark-rebirth-1-negro-espalda.webp"}}'::jsonb, 60, true),
  ('dark-rebirth-2', 'Camiseta Oversize DARK REBIRTH II', 'DARK REBIRTH', 'camiseta', 'Qatar Premium 240 g · también en Acid Wash', array['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']::text[], array['Negro']::text[], 140000, null, '{"Negro":{"frente":"img/productos/dark-rebirth-2-negro-frente.webp","espalda":"img/productos/dark-rebirth-2-negro-espalda.webp"}}'::jsonb, 70, true),
  ('dark-rebirth-3', 'Camiseta Oversize DARK REBIRTH III', 'DARK REBIRTH', 'camiseta', 'Qatar Premium 240 g · también en Acid Wash', array['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']::text[], array['Negro']::text[], 100000, null, '{"Negro":{"frente":"img/productos/dark-rebirth-3-negro-frente.webp"}}'::jsonb, 80, true),
  ('dark-rebirth-4', 'Camiseta Oversize DARK REBIRTH IV', 'DARK REBIRTH', 'camiseta', 'Qatar Premium 240 g · también en Acid Wash', array['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']::text[], array['Negro', 'Gris', 'Blanco']::text[], 100000, null, '{"Negro":{"frente":"img/productos/dark-rebirth-4-negro-frente.webp","espalda":"img/productos/dark-rebirth-4-negro-espalda.webp"}}'::jsonb, 90, true),
  ('dr-sudadera-1', 'Sudadera Oversize DARK REBIRTH I', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-1-negro.webp"}}'::jsonb, 100, true),
  ('dr-sudadera-2', 'Sudadera Oversize DARK REBIRTH II', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-2-negro.webp"}}'::jsonb, 110, true),
  ('dr-sudadera-3', 'Sudadera Oversize DARK REBIRTH III', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-3-negro.webp"}}'::jsonb, 120, true),
  ('dr-sudadera-4', 'Sudadera Oversize DARK REBIRTH IV', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Gris', 'Blanco']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-4-negro.webp"}}'::jsonb, 130, true),
  ('dr-sudadera-5', 'Sudadera Oversize DARK REBIRTH V', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Gris', 'Blanco']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-5-negro.webp"}}'::jsonb, 140, true),
  ('dr-sudadera-6', 'Sudadera Oversize DARK REBIRTH VI', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-6-negro.webp"}}'::jsonb, 150, true),
  ('dr-sudadera-7', 'Sudadera Oversize DARK REBIRTH VII', 'DARK REBIRTH', 'sudadera', 'Burda 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 150000, null, '{"Negro":{"frente":"img/productos/dr-sudadera-7-negro.webp"}}'::jsonb, 160, true),
  ('classic-oversize', 'Camiseta Oversize CLASSIC', 'CLASSIC', 'camiseta', 'Qatar Premium 240 g, Texturizado 230 g o Acid Wash (Acid Wash: Negro, Gris, Rojo, Rosado, Beige)', array['S', 'M', 'L', 'XL', '2XL']::text[], array['Negro', 'Blanco', 'Gris', 'Verde militar', 'Beige', 'Café', 'Azul', 'Rojo', 'Rosado']::text[], 100000, '[{"nombre":"Qatar Premium 240 g","precio":100000},{"nombre":"Texturizado 230 g","precio":100000},{"nombre":"Acid Wash","precio":108000}]'::jsonb, '{"Negro":{"frente":"img/productos/classic-negro-frente.webp"},"Blanco":{"frente":"img/productos/classic-blanco-frente.webp"}}'::jsonb, 170, true),
  ('insane-premium', 'Camiseta Oversize INSANE Premium', 'INSANE', 'camiseta', 'Qatar Premium 240 g · también en Acid Wash', array['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']::text[], array['Negro', 'Gris', 'Blanco', 'Verde militar', 'Rojo', 'Beige']::text[], 172000, null, '{"Negro":{"frente":"img/productos/insane-premium-negro-frente.webp","espalda":"img/productos/insane-premium-negro-espalda.webp"},"Blanco":{"frente":"img/productos/insane-premium-blanco-frente.webp","espalda":"img/productos/insane-premium-blanco-espalda.webp"}}'::jsonb, 180, true),
  ('insane-oversize', 'Camiseta Oversize INSANE', 'INSANE', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Gris oscuro', 'Blanco', 'Verde militar', 'Beige', 'Café', 'Azul', 'Rojo']::text[], 145000, null, '{"Negro":{"frente":"img/productos/insane-negro-frente.webp","espalda":"img/productos/insane-negro-espalda.webp"}}'::jsonb, 190, true),
  ('baki-hanma', 'Camiseta Oversize Baki Hanma', 'BAKI-INSPIRED', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL', '2XL']::text[], array['Negro']::text[], 163000, null, '{"Negro":{"frente":"img/productos/baki-hanma-frente.webp","espalda":"img/productos/baki-hanma-espalda.webp"}}'::jsonb, 200, true),
  ('baki-hanma-2', 'Camiseta Oversize Baki Hanma 2', 'BAKI-INSPIRED', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 163000, null, '{"Negro":{"frente":"img/productos/baki-hanma-2-frente.webp","espalda":"img/productos/baki-hanma-2-espalda.webp"}}'::jsonb, 210, true),
  ('jack-hanma', 'Camiseta Oversize Jack Hanma', 'BAKI-INSPIRED', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 163000, null, '{"Negro":{"frente":"img/productos/jack-hanma-frente.webp","espalda":"img/productos/jack-hanma-espalda.webp"}}'::jsonb, 220, true),
  ('yujiro-hanma', 'Camiseta Oversize Yujiro Hanma', 'BAKI-INSPIRED', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 163000, null, '{"Negro":{"frente":"img/productos/yujiro-hanma-frente.webp","espalda":"img/productos/yujiro-hanma-espalda.webp"}}'::jsonb, 230, true),
  ('remember-oversize', 'Camiseta Oversize REMEMBER', 'REMEMBER', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 130000, null, '{"Negro":{"frente":"img/productos/remember-frente.webp","espalda":"img/productos/remember-espalda.webp"}}'::jsonb, 240, true),
  ('versus-oversize', 'Camiseta Oversize VERSUS', 'VERSUS', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco']::text[], 145000, null, '{"Negro":{"frente":"img/productos/versus-frente.webp","espalda":"img/productos/versus-espalda.webp"}}'::jsonb, 250, true),
  ('classic-sudadera', 'Sudadera bota recta oversize CLASSIC', 'CLASSIC', 'sudadera', 'Burda · liviana y fresca', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto']::text[], 110000, null, '{"Negro":{"frente":"img/productos/classic-sudadera-negro.webp"}}'::jsonb, 260, true),
  ('insane-sudadera', 'Sudadera bota recta oversize INSANE', 'INSANE', 'sudadera', 'Burda · liviana y fresca', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro']::text[], 133000, null, '{"Negro":{"frente":"img/productos/insane-sudadera-negro.webp"}}'::jsonb, 270, true),
  ('iron-sudadera', 'Sudadera bota recta oversize IRON', 'IRON', 'sudadera', 'Burda · liviana y fresca', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto']::text[], 133000, null, '{"Negro":{"frente":"img/productos/iron-sudadera-negro.webp"}}'::jsonb, 280, true),
  ('omen-sudadera', 'Sudadera bota recta oversize OMEN SOCIETY', 'OMEN SOCIETY', 'sudadera', 'Burda o algodón perchado de alto gramaje', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 167000, '[{"nombre":"Burda","precio":167000},{"nombre":"Algodón perchado (alto gramaje)","precio":200000}]'::jsonb, '{"Negro":{"frente":"img/productos/omen-sudadera-negro.webp"}}'::jsonb, 290, true),
  ('redemption-sudadera', 'Sudadera bota recta oversize REDEMPTION', 'REDEMPTION', 'sudadera', 'Burda o algodón perchado de alto gramaje', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 167000, '[{"nombre":"Burda","precio":167000},{"nombre":"Algodón perchado (alto gramaje)","precio":200000}]'::jsonb, '{"Negro":{"frente":"img/productos/redemption-sudadera-negro.webp"}}'::jsonb, 300, true),
  ('super-oversize-cargo', 'Sudadera SUPER OVERSIZE CARGO', 'SUPER OVERSIZE CARGO', 'sudadera', 'Algodón perchado de alto gramaje · bolsillos cargo', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Beige', 'Gris', 'Vinotinto']::text[], 197000, null, '{"Negro":{"frente":"img/productos/cargo-negro-frente.webp","espalda":"img/productos/cargo-negro-espalda.webp"}}'::jsonb, 310, true),
  ('jogger', 'Sudadera JOGGER', 'JOGGERS', 'jogger', 'Burda · ajuste en tobillos · todos los diseños de sudadera oversize disponibles', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Beige', 'Verde militar', 'Vinotinto']::text[], 120000, '[{"nombre":"Liso","precio":120000},{"nombre":"Con diseño","precio":147000}]'::jsonb, '{"Negro":{"frente":"img/productos/jogger-negro.webp","espalda":"img/productos/jogger-diseno-negro.webp"}}'::jsonb, 320, true),
  ('insanity-order-compresion', 'Camiseta de compresión INSANITY ORDER', 'INSANITY ORDER', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo']::text[], 75000, null, '{"Negro":{"frente":"img/productos/insanity-order-negro.webp"}}'::jsonb, 330, true),
  ('no-mercy-compresion', 'Camiseta de compresión NO MERCY', 'NO MERCY', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo']::text[], 70000, null, '{"Negro":{"frente":"img/productos/no-mercy-negro.webp"}}'::jsonb, 340, true),
  ('classic-compresion', 'Camiseta de compresión CLASSIC', 'CLASSIC', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto', 'Rojo']::text[], 65000, null, '{"Negro":{"frente":"img/productos/classic-compresion-negro.webp"}}'::jsonb, 350, true),
  ('rebelion-compresion', 'Camiseta de compresión REBELION', 'REBELION', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo']::text[], 75000, null, '{"Negro":{"frente":"img/productos/rebelion-compresion-negro.webp"}}'::jsonb, 360, true),
  ('berserk-compresion', 'Camiseta de compresión BERSERK', 'BERSERK', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo']::text[], 65000, null, '{"Blanco":{"frente":"img/productos/berserk-compresion-blanco.webp"}}'::jsonb, 370, true),
  ('buzo-compresion', 'Buzo de compresión', 'CLASSIC', 'compresion', 'Licrado · liviano y fresco · secado rápido · disponible en todos los diseños de compresión', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto']::text[], 75000, null, '{"Negro":{"frente":"img/productos/buzo-compresion-negro.webp"}}'::jsonb, 380, true),
  ('rebelion-buzo', 'Buzo de compresión REBELION', 'REBELION', 'compresion', 'Licrado · liviano y fresco · secado rápido', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 90000, null, '{"Negro":{"frente":"img/productos/rebelion-buzo-negro.webp"}}'::jsonb, 390, true),
  ('esqueleto-classic', 'Esqueleto de compresión CLASSIC', 'CLASSIC', 'camisilla', 'Licrado · liviano y fresco · secado rápido · disponible con diseños de compresión', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto', 'Rojo']::text[], 50000, null, '{"Negro":{"frente":"img/productos/esqueleto-classic.webp"}}'::jsonb, 400, true),
  ('crypt-camisilla', 'Camisilla CRYPT', 'CRYPT', 'camisilla', 'Camisilla', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Rojo', 'Azul oscuro', 'Verde militar']::text[], 75000, null, '{"Negro":{"frente":"img/productos/crypt-negro.webp"},"Blanco":{"frente":"img/productos/crypt-blanco.webp"},"Gris":{"frente":"img/productos/crypt-gris.webp"},"Rojo":{"frente":"img/productos/crypt-rojo.webp"}}'::jsonb, 410, true),
  ('death-ascent-camisilla', 'Camisilla DEATH ASCENT', 'DEATH ASCENT', 'camisilla', 'Camisilla', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Rojo', 'Azul oscuro', 'Verde militar']::text[], 75000, null, '{"Negro":{"frente":"img/productos/death-ascent-negro.webp"},"Blanco":{"frente":"img/productos/death-ascent-blanco.webp"}}'::jsonb, 420, true),
  ('senki-guardiana', 'SENKI — La Guardiana del Instinto', 'SENKI', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Blanco']::text[], 133000, null, '{"Blanco":{"frente":"img/productos/senki-guardiana-frente.webp","espalda":"img/productos/senki-guardiana-espalda.webp"}}'::jsonb, 430, true),
  ('senki-elegida', 'SENKI — La Elegida del Filo', 'SENKI', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Blanco']::text[], 133000, null, '{"Blanco":{"frente":"img/productos/senki-elegida-frente.webp","espalda":"img/productos/senki-elegida-espalda.webp"}}'::jsonb, 440, true),
  ('senki-serenidad', 'SENKI — La Serenidad del Poder', 'SENKI', 'camiseta', 'Qatar Premium 240 g', array['S', 'M', 'L', 'XL']::text[], array['Blanco']::text[], 133000, null, '{"Blanco":{"frente":"img/productos/senki-serenidad-frente.webp","espalda":"img/productos/senki-serenidad-espalda.webp"}}'::jsonb, 450, true),
  ('crop-top-classic', 'Crop Top Oversize CLASSIC', 'CLASSIC', 'top', 'Algodón premium 190 g', array['S', 'M', 'L']::text[], array['Negro', 'Blanco', 'Gris claro']::text[], 75000, null, '{"Negro":{"frente":"img/productos/crop-classic-negro.webp"}}'::jsonb, 460, true),
  ('crop-top-primera', 'Crop Top Oversize (Primera Edición)', 'PRIMERA EDICIÓN', 'top', 'Algodón premium 190 g', array['S', 'M', 'L']::text[], array['Negro', 'Blanco', 'Gris claro']::text[], 80000, null, '{"Negro":{"frente":"img/productos/crop-primera-frente.webp","espalda":"img/productos/crop-primera-espalda.webp"}}'::jsonb, 470, true),
  ('sport-camiseta', 'Camiseta SPORT', 'SPORT', 'camiseta', 'Licra', array['Única']::text[], array['Negro', 'Blanco', 'Gris oscuro', 'Vinotinto', 'Verde militar', 'Gris claro']::text[], 60000, null, '{"Blanco":{"frente":"img/productos/sport-camiseta-blanco.webp"}}'::jsonb, 480, true),
  ('sport-chaqueta', 'Chaqueta SPORT', 'SPORT', 'chaqueta', 'Licra', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris oscuro', 'Vinotinto', 'Verde militar', 'Gris claro', 'Mora leche', 'Verde pastel']::text[], 105000, null, '{"Negro":{"frente":"img/productos/sport-chaqueta-negro.webp"}}'::jsonb, 490, true),
  ('runner-pantaloneta', 'Pantaloneta RUNNER', 'RUNNER', 'pantaloneta', 'Bolsillos laterales y ranuras a los lados (opcional con licra por debajo)', array['S', 'M', 'L']::text[], array['Negro', 'Blanco', 'Gris', 'Beige', 'Verde militar', 'Café']::text[], 90000, '[{"nombre":"Burda","precio":90000},{"nombre":"Semi impermeable","precio":90000}]'::jsonb, '{"Beige":{"frente":"img/productos/runner-beige.webp"}}'::jsonb, 500, true),
  ('short-licra', 'Short LICRA clásico', 'SHORT LICRA', 'short', 'Licra', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Gris', 'Verde militar', 'Blanco', 'Vinotinto', 'Rojo']::text[], 55000, null, '{"Negro":{"frente":"img/productos/short-licra-negro.webp"}}'::jsonb, 510, true),
  ('top-deportivo', 'Top deportivo', 'TOPS', 'top', 'Nylon de alta resistencia y elasticidad · doble tela, cero transparencias', array['S', 'M', 'L']::text[], array['Negro', 'Vinotinto']::text[], 55000, null, '{"Negro":{"frente":"img/productos/top-negro.webp"},"Vinotinto":{"frente":"img/productos/top-rojo.webp"}}'::jsonb, 520, true)
on conflict (id) do nothing;
