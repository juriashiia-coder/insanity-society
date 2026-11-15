-- =========================================================
-- INSANITY SOCIETY — Ajuste de textos al catálogo agosto 2026
-- Cambia en la franja de Inicio "Algodón premium · 200 g" por
-- "Qatar Premium · 240 g · corte oversize".
-- Supabase > SQL Editor > New query > pegar > Run.
-- (También puedes hacerlo a mano en el panel, pestaña Inicio.)
-- =========================================================
update public.contenido
set valor = jsonb_set(valor, '{franja}', (
  select jsonb_agg(
           case when e->>'titulo' ilike 'algod%'
                then jsonb_build_object('titulo', 'Qatar Premium', 'texto', '240 g · corte oversize')
                else e end
           order by i)
  from jsonb_array_elements(valor->'franja') with ordinality as t(e, i)))
where clave = 'inicio' and jsonb_typeof(valor->'franja') = 'array';

select valor->'franja' as franja_actual from public.contenido where clave = 'inicio';
