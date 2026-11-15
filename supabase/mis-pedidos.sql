-- =========================================================
-- INSANITY SOCIETY — "Mis pedidos" (seguimiento para clientes)
-- Ejecuta este archivo DESPUÉS de pedidos.sql:
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin problema.
--
-- Los clientes NO pueden leer la tabla de pedidos. Solo pueden consultar
-- un pedido si conocen su número Y el celular con el que se hizo, y la
-- respuesta no incluye dirección, cédula ni nombre.
-- =========================================================

-- Número de guía / transportadora (lo escribes en el panel al enviar)
alter table public.pedidos add column if not exists guia text;
alter table public.pedidos drop constraint if exists pedidos_guia_check;
alter table public.pedidos add constraint pedidos_guia_check check (guia is null or length(guia) <= 120);

-- Consulta de estado: recibe hasta 20 pares {id, celular}
create or replace function public.consultar_pedidos(p_consultas jsonb)
returns table (
  id bigint, fecha timestamptz, estado text, items jsonb,
  subtotal integer, descuento integer, total integer, cupon text, guia text, ciudad text
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.fecha, p.estado,
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'nombre', i->>'nombre', 'color', i->>'color', 'talla', i->>'talla',
                   'variante', i->>'variante', 'cantidad', (i->>'cantidad')::int, 'precio', (i->>'precio')::int)), '[]'::jsonb)
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
