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
  ('kyoki-oversize', 'Camiseta Oversize KYO-KI', 'KYO-KI', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris']::text[], 130000, null, '{"Negro":{"frente":"img/productos/kyoki-negro-frente.webp","espalda":"img/productos/kyoki-negro-espalda.webp"},"Blanco":{"frente":"img/productos/kyoki-blanco-frente.webp","espalda":"img/productos/kyoki-blanco-espalda.webp"}}'::jsonb, 10, true),
  ('shoka-oversize', 'Camiseta Oversize SHOKA', 'SHOKA', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris']::text[], 125000, null, '{"Negro":{"frente":"img/productos/shoka-negro-frente.webp","espalda":"img/productos/shoka-negro-espalda.webp"}}'::jsonb, 20, true),
  ('shugo-oversize', 'Camiseta Oversize SHUGO', 'SHUGO', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris']::text[], 130000, null, '{"Negro":{"frente":"img/productos/shugo-negro-frente.webp","espalda":"img/productos/shugo-negro-espalda.webp"}}'::jsonb, 30, true),
  ('blood-and-steel-202', 'Camiseta Oversize BLOOD AND STEEL - 202', 'BLOOD AND STEEL', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 140000, null, '{"Negro":{"frente":"img/productos/blood-and-steel-negro-frente.webp","espalda":"img/productos/blood-and-steel-negro-espalda.webp"}}'::jsonb, 40, true),
  ('raijin-oversize', 'Camiseta Oversize RAIJIN', 'RAIJIN', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], null, null, null, 50, true),
  ('classic-oversize', 'Camiseta Oversize CLASSIC', 'CLASSIC', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris oscuro', 'Verde militar', 'Azul turquí']::text[], 95000, null, null, 60, true),
  ('insane-oversize', 'Camiseta Oversize INSANE', 'INSANE', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Gris oscuro', 'Blanco', 'Verde militar']::text[], 130000, null, null, 70, true),
  ('baki-hanma', 'Camiseta Oversize Baki Hanma', 'BAKI-INSPIRED', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 130000, null, null, 80, true),
  ('baki-hanma-2', 'Camiseta Oversize Baki Hanma 2', 'BAKI-INSPIRED', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 130000, null, null, 90, true),
  ('jack-hanma', 'Camiseta Oversize Jack Hanma', 'BAKI-INSPIRED', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 130000, null, null, 100, true),
  ('yujiro-hanma', 'Camiseta Oversize Yujiro Hanma', 'BAKI-INSPIRED', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 130000, null, null, 110, true),
  ('remember-oversize', 'Camiseta Oversize REMEMBER', 'REMEMBER', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 140000, null, null, 120, true),
  ('versus-oversize', 'Camiseta Oversize VERSUS', 'VERSUS', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 140000, null, null, 130, true),
  ('raw-society-oversize', 'Camiseta Oversize RAW SOCIETY', 'RAW SOCIETY', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris']::text[], 140000, null, null, 140, true),
  ('break-your-limits', 'Camiseta Oversize BREAK YOUR LIMITS', 'STREET STRENGTH', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 145000, null, null, 150, true),
  ('still-your-best', 'Camiseta Oversize STILL YOUR BEST', 'STREET STRENGTH', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 145000, null, null, 160, true),
  ('iron-sudadera', 'Sudadera bota recta oversize IRON', 'IRON', 'sudadera', 'Burda', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Beige', 'Verde militar', 'Vinotinto']::text[], 110000, null, null, 170, true),
  ('omen-sudadera', 'Sudadera bota recta oversize OMEN SOCIETY', 'OMEN SOCIETY', 'sudadera', 'Burda o algodón perchado de alto gramaje', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 140000, '[{"nombre":"Burda","precio":140000},{"nombre":"Algodón perchado","precio":190000}]'::jsonb, null, 180, true),
  ('redemption-sudadera', 'Sudadera bota recta oversize REDEMPTION', 'REDEMPTION', 'sudadera', 'Burda o algodón perchado de alto gramaje', array['S', 'M', 'L', 'XL']::text[], array['Negro']::text[], 140000, '[{"nombre":"Burda","precio":140000},{"nombre":"Algodón perchado","precio":190000}]'::jsonb, null, 190, true),
  ('sixfold-nin', 'SIXFOLD – NIN (忍)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 200, true),
  ('sixfold-ha', 'SIXFOLD – HA (破)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 210, true),
  ('sixfold-retsu', 'SIXFOLD – RETSU (烈)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 220, true),
  ('sixfold-mamoru', 'SIXFOLD – MAMORU (守)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 230, true),
  ('sixfold-yami', 'SIXFOLD – YAMI (闇)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 240, true),
  ('sixfold-tamashii', 'SIXFOLD – TAMASHII (魂)', 'SIXFOLD', 'camiseta', 'Algodón premium 200 g', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris', 'Beige']::text[], 120000, null, null, 250, true),
  ('rebelion-compresion', 'Camiseta de compresión REBELION', 'REBELION', 'compresion', 'Licrado', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto']::text[], 80000, null, null, 260, true),
  ('berserk-compresion', 'Camiseta de compresión BERSERK', 'BERSERK', 'compresion', 'Licrado', array['S', 'M', 'L', 'XL']::text[], array['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo']::text[], 70000, null, null, 270, true),
  ('crop-top-primera', 'Crop Top Oversize (Primera Edición)', 'PRIMERA EDICIÓN', 'top', 'Algodón premium 190 g', array['S', 'M', 'L']::text[], array['Negro', 'Blanco', 'Gris claro']::text[], 75000, null, null, 280, true),
  ('sport-camiseta', 'Camiseta SPORT', 'SPORT', 'camiseta', 'Licra', array['Única']::text[], array['Negro', 'Blanco', 'Gris claro']::text[], 80000, null, null, 290, true),
  ('rift-pantaloneta', 'Pantaloneta RIFT', 'RIFT', 'pantaloneta', 'Burda', array['S', 'M', 'L']::text[], array['Negro', 'Blanco', 'Gris']::text[], 75000, null, null, 300, true),
  ('short-licra', 'Short LICRA clásico', 'SHORT LICRA', 'short', 'Licra', array['S', 'M', 'L']::text[], array['Negro']::text[], 45000, null, null, 310, true)
on conflict (id) do nothing;
