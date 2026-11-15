-- =========================================================
-- INSANITY SOCIETY — Destacados, ofertas y códigos de descuento
-- Ejecuta este archivo DESPUÉS de setup.sql:
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================

-- 1) Productos: destacado en Inicio y oferta (% de descuento con fecha de fin opcional)
alter table public.productos add column if not exists destacado boolean not null default false;
alter table public.productos add column if not exists oferta_pct integer;
alter table public.productos add column if not exists oferta_hasta timestamptz;
alter table public.productos drop constraint if exists productos_oferta_pct_check;
alter table public.productos add constraint productos_oferta_pct_check
  check (oferta_pct is null or (oferta_pct between 1 and 90));

-- Destacados iniciales (puedes cambiarlos desde el panel)
update public.productos set destacado = true
where id in ('control-vs-chaos', 'revelation', 'awakening', 'insane-premium')
  and not exists (select 1 from public.productos where destacado);

-- 2) Códigos de descuento
create table if not exists public.cupones (
  codigo        text primary key check (codigo = upper(codigo) and length(codigo) between 3 and 30),
  tipo          text not null check (tipo in ('porcentaje', 'valor')),
  valor         integer not null check (valor > 0),
  minimo_compra integer not null default 0 check (minimo_compra >= 0),
  vence         timestamptz,
  activo        boolean not null default true,
  nota          text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cupones_porcentaje_max check (tipo <> 'porcentaje' or valor <= 90)
);

drop trigger if exists cupones_actualizado on public.cupones;
create trigger cupones_actualizado before update on public.cupones
  for each row execute function public.tocar_actualizado();

-- Seguridad: la lista de cupones SOLO la ve el administrador.
-- Los clientes no pueden listar códigos; solo validar uno que ya conocen.
alter table public.cupones enable row level security;

drop policy if exists "cupones admin lee" on public.cupones;
create policy "cupones admin lee" on public.cupones
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "cupones admin crea" on public.cupones;
create policy "cupones admin crea" on public.cupones
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "cupones admin edita" on public.cupones;
create policy "cupones admin edita" on public.cupones
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "cupones admin borra" on public.cupones;
create policy "cupones admin borra" on public.cupones
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.cupones from anon;
grant select, insert, update, delete on public.cupones to authenticated;

-- 3) Validar un código desde la tienda (devuelve el cupón solo si está activo y vigente)
-- Solo se crea si todavía no existe: así, volver a correr este archivo
-- NUNCA reemplaza la versión más nueva (supabase/cupones-preventa.sql).
do $instalar$
begin
  if to_regprocedure('public.validar_cupon(text)') is null then
    execute $fn$
create function public.validar_cupon(p_codigo text)
returns table (codigo text, tipo text, valor integer, minimo_compra integer)
language sql stable security definer
set search_path = public
as $$
  select c.codigo, c.tipo, c.valor, c.minimo_compra
  from public.cupones c
  where c.codigo = upper(trim(p_codigo))
    and c.activo
    and (c.vence is null or c.vence > now())
  limit 1;
$$
$fn$;
  end if;
end
$instalar$;
revoke all on function public.validar_cupon(text) from public;
grant execute on function public.validar_cupon(text) to anon, authenticated;

-- Cupón de ejemplo (desactivado). Edítalo o bórralo desde el panel.
insert into public.cupones (codigo, tipo, valor, minimo_compra, activo, nota)
values ('BIENVENIDO10', 'porcentaje', 10, 0, false, 'Ejemplo: 10% en toda la compra')
on conflict (codigo) do nothing;
