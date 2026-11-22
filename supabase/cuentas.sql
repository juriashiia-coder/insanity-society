-- =========================================================
-- INSANITY SOCIETY — Cuentas de clientes
-- Ejecuta este archivo DESPUÉS de embajadores.sql:
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin problema.
--
-- Cómo funciona:
--  * Para agregar al carrito, usar códigos y pedir, el cliente necesita una cuenta
--    (correo + contraseña o Google). La web lo exige y el servidor también.
--  * Cada cuenta tiene un celular y un celular solo puede estar en UNA cuenta.
--  * Al crear la cuenta recibe su código de bienvenida (el % de "Lista VIP" del panel).
--    Un solo código por celular en toda la vida: si ese celular ya tenía código
--    (por la Lista VIP anterior), se le asigna ese mismo, no uno nuevo.
--  * Los códigos personales solo sirven en la cuenta de su dueño.
--  * "Usos por persona" de cualquier código se cuenta por cuenta, por celular
--    y por cédula: crear otra cuenta con la misma cédula no sirve para repetir.
--  * Los datos de los clientes SOLO los ve el administrador.
-- =========================================================

-- ---------- 1) Tabla de clientes ----------
create table if not exists public.clientes (
  id             uuid primary key references auth.users (id) on delete cascade,
  creado_en      timestamptz not null default now(),
  nombre         text not null check (length(nombre) between 2 and 80),
  celular        text not null unique check (celular ~ '^3\d{9}$'),
  correo         text check (length(correo) <= 160),
  acepta_promos  boolean not null default false,
  codigo_bienvenida text
);
create index if not exists clientes_creado_idx on public.clientes (creado_en desc);

alter table public.clientes enable row level security;
drop policy if exists "clientes ve su cuenta" on public.clientes;
create policy "clientes ve su cuenta" on public.clientes
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "clientes admin edita" on public.clientes;
create policy "clientes admin edita" on public.clientes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "clientes admin borra" on public.clientes;
create policy "clientes admin borra" on public.clientes
  for delete to authenticated using ((select public.is_admin()));
revoke all on public.clientes from anon;
grant select, update, delete on public.clientes to authenticated;
-- (Las cuentas se crean solo con la función registrar_cliente, nunca escribiendo directo.)

-- ---------- 2) Pedidos y cupones ligados a la cuenta ----------
alter table public.pedidos add column if not exists cliente_id uuid references auth.users (id) on delete set null;
create index if not exists pedidos_cliente_idx on public.pedidos (cliente_id) where cliente_id is not null;
alter table public.cupones add column if not exists cliente_id uuid references auth.users (id) on delete set null;
create index if not exists cupones_cliente_idx on public.cupones (cliente_id) where cliente_id is not null;

-- ---------- 3) ¿Ese celular ya tiene cuenta? (para avisar antes de registrarse) ----------
create or replace function public.celular_disponible(p_celular text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  cel text := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
begin
  if cel ~ '^57\d{10}$' then cel := substr(cel, 3); end if;
  if cel !~ '^3\d{9}$' then return false; end if;
  return not exists (select 1 from public.clientes where celular = cel and id is distinct from auth.uid());
end;
$$;
revoke all on function public.celular_disponible(text) from public;
grant execute on function public.celular_disponible(text) to anon, authenticated;

-- ---------- 4) Datos de mi cuenta + estado de mi código de bienvenida ----------
create or replace function public.mi_cuenta()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  cl public.clientes%rowtype;
  cu public.cupones%rowtype;
  cfg jsonb;
  usado boolean := false;
begin
  if auth.uid() is null then return null; end if;
  select * into cl from public.clientes where id = auth.uid();
  if not found then return jsonb_build_object('perfil', null); end if;
  select valor into cfg from public.contenido where clave = 'vip';
  if cl.codigo_bienvenida is not null then
    select * into cu from public.cupones where codigo = cl.codigo_bienvenida;
    usado := exists (select 1 from public.pedidos p where p.cupon = cl.codigo_bienvenida and p.estado <> 'cancelado');
  end if;
  return jsonb_build_object(
    'perfil', jsonb_build_object('nombre', cl.nombre, 'celular', cl.celular, 'correo', cl.correo,
                                 'acepta_promos', cl.acepta_promos, 'creado_en', cl.creado_en),
    'bienvenida', case when cl.codigo_bienvenida is null then null else jsonb_build_object(
      'codigo', cl.codigo_bienvenida,
      'porcentaje', cu.valor,
      'minimo_compra', cu.minimo_compra,
      'vence', cu.vence,
      'usado', usado,
      'disponible', not usado and coalesce(cu.activo, false)
                    and (cu.vence is null or cu.vence > now())
                    and not coalesce((cfg->>'codigos_pausados')::boolean, false),
      'motivo', case when usado then 'usado'
                     when not coalesce(cu.activo, false) then 'inactivo'
                     when cu.vence is not null and cu.vence <= now() then 'vencido'
                     when coalesce((cfg->>'codigos_pausados')::boolean, false) then 'pausado' end
    ) end
  );
end;
$$;
revoke all on function public.mi_cuenta() from public;
grant execute on function public.mi_cuenta() to authenticated;

-- ---------- 5) Crear el perfil de la cuenta (y entregar el código de bienvenida) ----------
create or replace function public.registrar_cliente(p_nombre text, p_celular text, p_promos boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cel text := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
  v_nombre text := left(trim(coalesce(p_nombre, '')), 80);
  v_correo text;
  cfg jsonb;
  pct integer;
  minimo integer;
  dias integer;
  cod text;
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'CUENTA_REQUERIDA'; end if;
  if exists (select 1 from public.clientes where id = uid) then
    return public.mi_cuenta(); -- ya estaba registrado: no se hace nada más
  end if;
  if cel ~ '^57\d{10}$' then cel := substr(cel, 3); end if;
  if cel !~ '^3\d{9}$' then raise exception 'CELULAR_INVALIDO'; end if;
  if length(v_nombre) < 2 then raise exception 'NOMBRE_INVALIDO'; end if;
  if exists (select 1 from public.clientes where celular = cel) then raise exception 'CELULAR_EN_USO'; end if;
  -- Freno contra registros masivos automáticos
  if (select count(*) from public.clientes where creado_en > now() - interval '1 minute') >= 30 then
    raise exception 'INTENTA_LUEGO';
  end if;

  select lower(email) into v_correo from auth.users where id = uid;
  insert into public.clientes (id, nombre, celular, correo, acepta_promos)
  values (uid, v_nombre, cel, left(v_correo, 160), coalesce(p_promos, false));

  -- Código de bienvenida: uno por celular en toda la vida
  select valor into cfg from public.contenido where clave = 'vip';
  dias := nullif(cfg->>'dias_validez', '')::integer;
  select codigo into cod from public.cupones where celular_vip = cel order by creado_en limit 1;
  if cod is not null then
    -- Hereda el código que ese celular ya tenía (Lista VIP anterior). Si nunca lo usó pero
    -- quedó apagado o vencido, y el regalo está activo, se reactiva con validez nueva.
    update public.cupones c
       set cliente_id = uid,
           activo = case when reactivar then true else c.activo end,
           vence = case when reactivar then (case when dias > 0 then now() + make_interval(days => dias) end) else c.vence end
      from (select coalesce((cfg->>'regalo_activo')::boolean, false)
                   and not exists (select 1 from public.pedidos p where p.cupon = cod and p.estado <> 'cancelado') as reactivar) r
     where c.codigo = cod;
  else
    if coalesce((cfg->>'regalo_activo')::boolean, false) then
      pct := nullif(cfg->>'porcentaje', '')::integer;
      if pct between 1 and 90 then
        minimo := coalesce(nullif(cfg->>'minimo_compra', '')::integer, 0);
        loop
          cod := 'BIEN-' || (select string_agg(substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1), '')
                               from generate_series(1, 5));
          exit when not exists (select 1 from public.cupones where codigo = cod);
        end loop;
        insert into public.cupones (codigo, tipo, valor, minimo_compra, vence, activo, nota,
                                    usos_por_cliente, usos_maximos, celular_vip, cliente_id)
        values (cod, 'porcentaje', pct, greatest(minimo, 0),
                case when dias > 0 then now() + make_interval(days => dias) end,
                true, 'Bienvenida · ' || cel, 1, 1, cel, uid);
      end if;
    end if;
  end if;
  if cod is not null then
    update public.clientes set codigo_bienvenida = cod where id = uid;
  end if;

  -- Quien acepta promociones queda en la Lista VIP (la lista de difusión)
  if coalesce(p_promos, false) then
    insert into public.suscriptores (nombre, celular, correo, codigo, origen)
    values (v_nombre, cel, left(v_correo, 120), cod, 'cuenta')
    on conflict (celular) do update
      set nombre = excluded.nombre,
          correo = coalesce(excluded.correo, suscriptores.correo),
          codigo = coalesce(suscriptores.codigo, excluded.codigo),
          activo = true;
  end if;

  return public.mi_cuenta();
end;
$$;
revoke all on function public.registrar_cliente(text, text, boolean) from public;
grant execute on function public.registrar_cliente(text, text, boolean) to authenticated;

-- ---------- 6) Validar códigos: los personales solo para su dueño ----------
create or replace function public.validar_cupon(p_codigo text)
returns table (codigo text, tipo text, valor integer, minimo_compra integer)
language sql stable security definer
set search_path = public
as $$
  select c.codigo, c.tipo, c.valor, c.minimo_compra
  from public.cupones c
  where (c.codigo = upper(trim(p_codigo))
         -- Código exclusivo J-W DEV: se reconoce aunque lo escriban "jwdev", "JW DEV", "j-w-dev"…
         or (c.codigo = 'J-W DEV' and regexp_replace(upper(coalesce(p_codigo, '')), '[^A-Z0-9]', '', 'g') = 'JWDEV'))
    and c.activo
    and (c.vence is null or c.vence > now())
    and (c.usos_maximos is null
         or (select count(*) from public.pedidos p where p.cupon = c.codigo and p.estado <> 'cancelado') < c.usos_maximos)
    -- Códigos personales (bienvenida / Lista VIP): se pueden pausar todos desde el panel
    and (c.celular_vip is null
         or not coalesce((select (k.valor->>'codigos_pausados')::boolean from public.contenido k where k.clave = 'vip'), false))
    -- Código ligado a una cuenta: solo lo ve su dueño
    and (c.cliente_id is null or c.cliente_id = auth.uid())
  limit 1;
$$;
comment on function public.validar_cupon(text) is 'Insanity [cuentas]';
revoke all on function public.validar_cupon(text) from public;
grant execute on function public.validar_cupon(text) to anon, authenticated;

-- ---------- Código exclusivo del desarrollador: J-W DEV ----------
-- Es el ÚNICO código con guion y espacio. Se edita en el panel (porcentaje, límites,
-- vencimiento, activo), pero no se puede renombrar ni borrar, y nadie puede crear
-- otro parecido (JWDEV, JW-DEV, J W DEV…).
drop index if exists public.cupones_codigo_normalizado_idx;
insert into public.cupones (codigo, tipo, valor, minimo_compra, activo, nota, usos_por_cliente)
values ('J-W DEV', 'porcentaje', 10, 0, false, 'Código exclusivo del desarrollador (J-W DEV)', 1)
on conflict (codigo) do nothing;

create or replace function public.proteger_codigo_exclusivo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.codigo = 'J-W DEV' then raise exception 'CODIGO_EXCLUSIVO: J-W DEV no se puede borrar (puedes pausarlo).'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.codigo = 'J-W DEV' and new.codigo <> old.codigo then
    raise exception 'CODIGO_EXCLUSIVO: J-W DEV no se puede renombrar.';
  end if;
  if tg_op = 'UPDATE' and old.codigo = 'J-W DEV' and old.embajador_id is not null and new.embajador_id is null then
    raise exception 'CODIGO_EXCLUSIVO: J-W DEV debe seguir ligado a su comisión.';
  end if;
  if new.codigo <> 'J-W DEV' and regexp_replace(upper(new.codigo), '[^A-Z0-9]', '', 'g') = 'JWDEV' then
    raise exception 'CODIGO_EXCLUSIVO: ese código está reservado.';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_codigo_exclusivo on public.cupones;
create trigger proteger_codigo_exclusivo
  before insert or update or delete on public.cupones
  for each row execute function public.proteger_codigo_exclusivo();

-- J-W DEV también gana comisión: es un embajador exclusivo (pestaña Embajadores del panel)
do $jwdev$
declare
  v_id bigint;
begin
  select embajador_id into v_id from public.cupones where codigo = 'J-W DEV';
  if v_id is null then
    insert into public.embajadores (nombre, comision_pct, activo, notas)
    values ('J-W DEV', 10, true, 'Desarrollador de la web · código exclusivo')
    returning id into v_id;
    update public.cupones set embajador_id = v_id where codigo = 'J-W DEV';
  end if;
  -- Pedidos que ya hubieran usado J-W DEV antes de esto
  update public.pedidos p
     set embajador_id = v_id, comision_pct = e.comision_pct
    from public.embajadores e
   where e.id = v_id and p.cupon = 'J-W DEV' and p.embajador_id is null;
end
$jwdev$;

-- El embajador de J-W DEV no se puede borrar (solo pausar)
create or replace function public.proteger_embajador_exclusivo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.cupones where codigo = 'J-W DEV' and embajador_id = old.id) then
    raise exception 'CODIGO_EXCLUSIVO: el embajador de J-W DEV no se puede borrar (puedes pausarlo).';
  end if;
  return old;
end;
$$;
drop trigger if exists proteger_embajador_exclusivo on public.embajadores;
create trigger proteger_embajador_exclusivo
  before delete on public.embajadores
  for each row execute function public.proteger_embajador_exclusivo();

-- Para el carrito: dice por qué un código no sirve en MI cuenta
create or replace function public.revisar_cupon(p_codigo text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cl public.clientes%rowtype;
  v record;
  c public.cupones%rowtype;
  usados integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'motivo', 'CUENTA_REQUERIDA'); end if;
  select * into cl from public.clientes where id = uid;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'PERFIL_INCOMPLETO'); end if;
  select * into v from public.validar_cupon(p_codigo);
  if not found then return jsonb_build_object('ok', false, 'motivo', 'CUPON_NO_VALIDO'); end if;
  select * into c from public.cupones where codigo = v.codigo;
  if c.cliente_id is null and c.celular_vip is not null and c.celular_vip <> cl.celular then
    return jsonb_build_object('ok', false, 'motivo', 'CUPON_PERSONAL');
  end if;
  if coalesce(c.usos_por_cliente, 1) > 0 then
    select count(*) into usados from public.pedidos p
     where p.cupon = c.codigo and p.estado <> 'cancelado'
       and (p.cliente_id = uid or p.celular = cl.celular);
    if usados >= coalesce(c.usos_por_cliente, 1) then
      return jsonb_build_object('ok', false, 'motivo', 'CUPON_YA_USADO');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'codigo', v.codigo, 'tipo', v.tipo, 'valor', v.valor, 'minimo_compra', v.minimo_compra);
end;
$$;
revoke all on function public.revisar_cupon(text) from public;
grant execute on function public.revisar_cupon(text) to authenticated;

-- ---------- 7) Registrar pedidos: solo con cuenta ----------
create or replace function public.crear_pedido(p_items jsonb, p_cliente jsonb, p_cupon text default null)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cl public.clientes%rowtype;
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
  v_dueno_id uuid;
  v_cupon_final text;
  usados integer;
  cel text := left(regexp_replace(coalesce(p_cliente->>'celular', ''), '\D', '', 'g'), 20);
  ced text := left(regexp_replace(coalesce(p_cliente->>'cedula', ''), '\D', '', 'g'), 20);
  v_codigo text := nullif(upper(trim(coalesce(p_cupon, ''))), '');
  nuevo_id bigint;
begin
  if uid is null then raise exception 'CUENTA_REQUERIDA'; end if;
  select * into cl from public.clientes where id = uid;
  if not found then raise exception 'PERFIL_INCOMPLETO'; end if;

  if cel ~ '^57\d{10}$' then cel := substr(cel, 3); end if; -- +57 300... -> 300...
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Pedido inválido';
  end if;

  -- Freno básico contra abuso: máximo 5 pedidos por cuenta cada 10 minutos
  if (select count(*) from public.pedidos
       where (cliente_id = uid or (cel <> '' and celular = cel))
         and creado_en > now() - interval '10 minutes') >= 5 then
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
    select c.usos_por_cliente, c.celular_vip, c.cliente_id into limite, v_dueno, v_dueno_id
      from public.cupones c where c.codigo = cup.codigo;
    -- Código personal sin cuenta asignada (Lista VIP anterior): solo con el celular de quien se suscribió
    if v_dueno_id is null and v_dueno is not null and v_dueno <> cl.celular and v_dueno <> cel then
      raise exception 'CUPON_PERSONAL' using hint = 'Este código es personal de otra persona.';
    end if;
    -- ¿Esta persona ya lo usó? Misma cuenta, mismo celular o misma cédula (los cancelados no cuentan)
    if coalesce(limite, 1) > 0 then
      select count(*) into usados from public.pedidos p
       where p.cupon = cup.codigo and p.estado <> 'cancelado'
         and (p.cliente_id = uid
              or p.celular = cl.celular
              or (cel <> '' and p.celular = cel)
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

  insert into public.pedidos (estado, canal, cliente_id, cliente_nombre, celular, cedula, departamento, ciudad,
                              direccion, barrio, notas, items, subtotal, descuento, total, cupon)
  values ('pendiente', 'web', uid,
          left(p_cliente->>'nombre', 120), cel, nullif(ced, ''),
          left(p_cliente->>'departamento', 60), left(p_cliente->>'ciudad', 80),
          left(p_cliente->>'direccion', 200), left(p_cliente->>'barrio', 100), left(p_cliente->>'notas', 600),
          lineas, sub, desc_total, sub - desc_total,
          v_cupon_final)
  returning id into nuevo_id;

  return nuevo_id;
end;
$$;
comment on function public.crear_pedido(jsonb, jsonb, text) is 'Insanity [cuentas]';
revoke all on function public.crear_pedido(jsonb, jsonb, text) from public, anon;
grant execute on function public.crear_pedido(jsonb, jsonb, text) to authenticated;

-- ---------- 8) "Mis pedidos" de la cuenta ----------
create or replace function public.mis_pedidos()
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
   where auth.uid() is not null and p.cliente_id = auth.uid()
   order by p.fecha desc
   limit 50;
$$;
revoke all on function public.mis_pedidos() from public;
grant execute on function public.mis_pedidos() to authenticated;

-- ---------- 9) La invitación del sitio ahora es para crear cuenta ----------
update public.contenido
   set valor = valor || jsonb_build_object('titulo', 'Crea tu cuenta')
 where clave = 'vip' and coalesce(valor->>'titulo', '') in ('', 'Únete a la Sociedad');
update public.contenido
   set valor = valor || jsonb_build_object('texto', 'Guarda tus pedidos, síguelos desde cualquier dispositivo y entérate primero de lanzamientos y preventas.')
 where clave = 'vip' and coalesce(valor->>'texto', '') in ('', 'Entérate primero de lanzamientos, preventas y ofertas exclusivas.');
