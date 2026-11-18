-- =========================================================
-- INSANITY SOCIETY — Límite de uso de cupones + Preventa
-- Ejecuta este archivo DESPUÉS de pedidos.sql y mis-pedidos.sql:
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================

-- ---------- 1) Cupones: cuántas veces se pueden usar ----------
-- usos_por_cliente: veces que la MISMA persona (mismo celular o misma cédula)
--                   puede usar el código. 1 = una sola vez. 0 = sin límite.
-- usos_maximos:     usos en total entre todos los clientes (vacío = sin límite).
-- Los pedidos CANCELADOS no cuentan como uso.
alter table public.cupones add column if not exists usos_por_cliente integer not null default 1;
alter table public.cupones add column if not exists usos_maximos integer;
alter table public.cupones drop constraint if exists cupones_usos_check;
alter table public.cupones add constraint cupones_usos_check
  check (usos_por_cliente >= 0 and (usos_maximos is null or usos_maximos > 0));

create index if not exists pedidos_cupon_idx on public.pedidos (cupon) where cupon is not null;

-- Códigos personales (Lista VIP): solo funcionan con el celular de quien se suscribió
alter table public.cupones add column if not exists celular_vip text;
create index if not exists cupones_celular_vip_idx on public.cupones (celular_vip) where celular_vip is not null;

-- Validar un código desde el carrito: además de activo y vigente, que no se haya agotado
-- (Si ya corriste cuentas.sql, esta versión NO se instala: la de cuentas es más nueva.)
do $instalar$ begin
  if coalesce(obj_description(to_regprocedure('public.validar_cupon(text)'), 'pg_proc'), '') not like '%[cuentas]%' then
    execute $fn$create or replace function public.validar_cupon(p_codigo text)
returns table (codigo text, tipo text, valor integer, minimo_compra integer)
language sql stable security definer
set search_path = public
as $f$
  select c.codigo, c.tipo, c.valor, c.minimo_compra
  from public.cupones c
  where c.codigo = upper(trim(p_codigo))
    and c.activo
    and (c.vence is null or c.vence > now())
    and (c.usos_maximos is null
         or (select count(*) from public.pedidos p where p.cupon = c.codigo and p.estado <> 'cancelado') < c.usos_maximos)
    -- Códigos de la Lista VIP: se pueden pausar todos de una vez desde el panel
    and (c.celular_vip is null
         or not coalesce((select (k.valor->>'codigos_pausados')::boolean from public.contenido k where k.clave = 'vip'), false))
  limit 1;
$f$;
$fn$;
  end if;
end $instalar$;
revoke all on function public.validar_cupon(text) from public;
grant execute on function public.validar_cupon(text) to anon, authenticated;

-- ---------- 2) Preventa ----------
-- preventa = true        -> el producto se vende por adelantado
-- preventa_hasta         -> cierre de la preventa (después ya no se puede pedir)
-- preventa_entrega       -> texto libre, ej. "Desde el 15 de diciembre"
alter table public.productos add column if not exists preventa boolean not null default false;
alter table public.productos add column if not exists preventa_hasta timestamptz;
alter table public.productos add column if not exists preventa_entrega text;
alter table public.productos drop constraint if exists productos_preventa_entrega_check;
alter table public.productos add constraint productos_preventa_entrega_check
  check (preventa_entrega is null or length(preventa_entrega) <= 80);

-- ---------- 3) Registrar pedidos con estas reglas ----------
-- (Si ya corriste cuentas.sql, esta versión NO se instala: la de cuentas es más nueva.)
do $instalar$ begin
  if coalesce(obj_description(to_regprocedure('public.crear_pedido(jsonb,jsonb,text)'), 'pg_proc'), '') not like '%[cuentas]%' then
    execute $fn$create or replace function public.crear_pedido(p_items jsonb, p_cliente jsonb, p_cupon text default null)
returns bigint
language plpgsql security definer
set search_path = public
as $f$
declare
  it jsonb;
  pr public.productos%rowtype;
  base integer;
  pct integer;
  precio integer;
  cant integer;
  lineas jsonb := '[]'::jsonb;
  sub integer := 0;
  desc_total integer := 0;
  cup record;
  limite integer;
  v_dueno text;
  v_cupon_final text;
  usados integer;
  cel text := left(regexp_replace(coalesce(p_cliente->>'celular', ''), '\D', '', 'g'), 20);
  ced text := left(regexp_replace(coalesce(p_cliente->>'cedula', ''), '\D', '', 'g'), 20);
  v_codigo text := nullif(upper(trim(coalesce(p_cupon, ''))), '');
  nuevo_id bigint;
begin
  if cel ~ '^57\d{10}$' then cel := substr(cel, 3); end if; -- +57 300... -> 300...
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Pedido inválido';
  end if;

  -- Freno básico contra abuso: máximo 5 pedidos por celular cada 10 minutos
  if cel <> '' and (select count(*) from public.pedidos
                    where celular = cel and creado_en > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados pedidos seguidos. Intenta en unos minutos.';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.productos where id = it->>'id' and activo;
    if not found then continue; end if;
    -- Preventa cerrada: ya no se puede pedir
    if pr.preventa and pr.preventa_hasta is not null and pr.preventa_hasta <= now() then continue; end if;
    cant := least(greatest(coalesce((it->>'cantidad')::int, 1), 1), 20);

    base := pr.precio;
    if pr.variantes is not null and it->>'variante' is not null then
      select (v->>'precio')::int into base
        from jsonb_array_elements(pr.variantes) v
       where v->>'nombre' = it->>'variante' limit 1;
      base := coalesce(base, pr.precio);
    end if;
    if base is null then base := 0; end if;

    pct := case when coalesce(pr.oferta_pct, 0) between 1 and 90
                 and (pr.oferta_hasta is null or pr.oferta_hasta > now())
                then pr.oferta_pct else 0 end;
    precio := case when pct > 0 then (round(base * (100 - pct) / 100.0 / 100) * 100)::int else base end;

    lineas := lineas || jsonb_strip_nulls(jsonb_build_object(
      'id', pr.id, 'nombre', pr.nombre, 'coleccion', pr.coleccion, 'categoria', pr.categoria,
      'color', left(coalesce(it->>'color', ''), 40), 'talla', left(coalesce(it->>'talla', ''), 10),
      'variante', nullif(left(coalesce(it->>'variante', ''), 60), ''),
      'cantidad', cant, 'precio', precio, 'oferta', pct,
      'preventa', case when pr.preventa then true end,
      'entrega', case when pr.preventa then pr.preventa_entrega end));
    sub := sub + precio * cant;
  end loop;

  if jsonb_array_length(lineas) = 0 then raise exception 'Pedido sin productos válidos'; end if;

  if v_codigo is not null then
    select * into cup from public.validar_cupon(v_codigo);
    if not found then
      raise exception 'CUPON_NO_VALIDO' using hint = 'El código ya no está disponible.';
    end if;
    -- ¿Esta persona ya lo usó? (mismo celular o misma cédula; los cancelados no cuentan)
    select c.usos_por_cliente, c.celular_vip into limite, v_dueno from public.cupones c where c.codigo = cup.codigo;
    -- Código personal de la Lista VIP: solo con el celular de quien se suscribió
    if v_dueno is not null and v_dueno <> cel then
      raise exception 'CUPON_PERSONAL' using hint = 'Este código solo funciona con el celular con el que se suscribió.';
    end if;
    if coalesce(limite, 1) > 0 and (cel <> '' or ced <> '') then
      select count(*) into usados from public.pedidos p
       where p.cupon = cup.codigo and p.estado <> 'cancelado'
         and ((cel <> '' and p.celular = cel)
              or (ced <> '' and regexp_replace(coalesce(p.cedula, ''), '\D', '', 'g') = ced));
      if usados >= coalesce(limite, 1) then
        raise exception 'CUPON_YA_USADO' using hint = 'Este código ya fue usado con estos datos.';
      end if;
    end if;
    if sub >= coalesce(cup.minimo_compra, 0) then
      desc_total := least(sub, case when cup.tipo = 'porcentaje'
                                    then (round(sub * cup.valor / 100.0 / 100) * 100)::int
                                    else cup.valor end);
    end if;
    if desc_total > 0 then v_cupon_final := cup.codigo; end if;
  end if;

  insert into public.pedidos (estado, canal, cliente_nombre, celular, cedula, departamento, ciudad,
                              direccion, barrio, notas, items, subtotal, descuento, total, cupon)
  values ('pendiente', 'web',
          left(p_cliente->>'nombre', 120), cel, nullif(ced, ''),
          left(p_cliente->>'departamento', 60), left(p_cliente->>'ciudad', 80),
          left(p_cliente->>'direccion', 200), left(p_cliente->>'barrio', 100), left(p_cliente->>'notas', 600),
          lineas, sub, desc_total, sub - desc_total,
          v_cupon_final)
  returning id into nuevo_id;

  return nuevo_id;
end;
$f$;
$fn$;
  end if;
end $instalar$;
revoke all on function public.crear_pedido(jsonb, jsonb, text) from public;
grant execute on function public.crear_pedido(jsonb, jsonb, text) to anon, authenticated;

-- Para "Mis pedidos": mostrar también si un artículo es de preventa y su entrega
create or replace function public.consultar_pedidos(p_consultas jsonb)
returns table (
  id bigint, fecha timestamptz, estado text, items jsonb,
  subtotal integer, descuento integer, total integer, cupon text, guia text, ciudad text
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.fecha, p.estado,
         (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'nombre', i->>'nombre', 'color', i->>'color', 'talla', i->>'talla',
                   'variante', i->>'variante', 'cantidad', (i->>'cantidad')::int, 'precio', (i->>'precio')::int,
                   'preventa', i->'preventa', 'entrega', i->>'entrega'))), '[]'::jsonb)
            from jsonb_array_elements(p.items) i),
         p.subtotal, p.descuento, p.total, p.cupon, p.guia, p.ciudad
    from public.pedidos p
    join (select (c->>'id')::bigint as id,
                 regexp_replace(coalesce(c->>'celular', ''), '\D', '', 'g') as cel
            from jsonb_array_elements(
                   case when jsonb_typeof(p_consultas) = 'array' then p_consultas else '[]'::jsonb end
                 ) with ordinality as t(c, n)
           where n <= 20 and (c->>'id') ~ '^\d{1,12}$') q
      on q.id = p.id and q.cel <> '' and length(q.cel) >= 7 and p.celular = q.cel
   order by p.fecha desc;
$$;
revoke all on function public.consultar_pedidos(jsonb) from public;
grant execute on function public.consultar_pedidos(jsonb) to anon, authenticated;
