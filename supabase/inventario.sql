-- =========================================================
-- INSANITY SOCIETY — Inventario por color y talla
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin problema.
--
-- stock = null  -> el producto no controla inventario (se vende sin límite)
-- stock = {"Negro|M": 4, "Blanco|L": 0, ...} -> unidades por color y talla
-- =========================================================
alter table public.productos add column if not exists stock jsonb;

alter table public.productos drop constraint if exists productos_stock_check;
alter table public.productos add constraint productos_stock_check
  check (stock is null or jsonb_typeof(stock) = 'object');

-- Las reglas de seguridad de productos ya aplican: todos pueden ver las
-- unidades disponibles, pero solo el administrador puede cambiarlas.
