-- RLS para las tablas nuevas del modelo unificado.
--
-- IMPORTANTE — leer antes de aplicar: se detectó que las políticas RLS
-- realmente activas en Supabase pueden no coincidir con lo que muestran las
-- migraciones trackeadas (ej. la tienda pública lee `stock_albums`/`stock_stickers`
-- /`combos` sin sesión iniciada, pero 001_initial.sql solo les da políticas
-- "authenticated"). Antes de aplicar este archivo, exportar el esquema real
-- (Supabase Dashboard > Database > Policies, o `supabase db dump`) y ajustar
-- las políticas de abajo si la tienda pública necesita leer producto_variantes
-- directamente.
--
-- Por ahora se sigue el patrón MÁS RESTRICTIVO que sí está confirmado en las
-- migraciones (el de stock_albums/stock_stickers), no el más permisivo
-- (stock_accesorios/combos), porque producto_variantes expone precio_compra
-- (costo) y no debería quedar público por accidente (sección 30 del plan:
-- "no crear políticas... using(true) sin validar roles").
--
-- Si la tienda pública necesita listar variantes sin sesión, la opción segura
-- es una vista pública que excluya precio_compra/costo_unitario/notas, no abrir
-- la tabla completa a anon.

alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.producto_variantes enable row level security;
alter table public.inventario enable row level security;
alter table public.producto_variante_imagenes enable row level security;
alter table public.combo_componentes enable row level security;
alter table public.sale_items_v2 enable row level security;

-- categorias / productos: catálogo, lectura pública (nombre/imagen, nada sensible),
-- escritura solo admin (mismo patrón que albums/stickers en 001_initial.sql).
create policy "public read categorias" on public.categorias for select using (true);
create policy "admin write categorias" on public.categorias for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "public read productos" on public.productos for select using (true);
create policy "admin write productos" on public.productos for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

-- producto_variantes / inventario / imágenes: contienen costo (precio_compra) y
-- lote de compra. Solo usuarios autenticados (staff/admin), igual que
-- stock_albums/stock_stickers hoy.
create policy "authenticated read producto_variantes" on public.producto_variantes
  for select to authenticated using (true);
create policy "authenticated write producto_variantes" on public.producto_variantes
  for all to authenticated using (true) with check (true);

create policy "authenticated read inventario" on public.inventario
  for select to authenticated using (true);
create policy "authenticated write inventario" on public.inventario
  for all to authenticated using (true) with check (true);

create policy "authenticated read producto_variante_imagenes" on public.producto_variante_imagenes
  for select to authenticated using (true);
create policy "authenticated write producto_variante_imagenes" on public.producto_variante_imagenes
  for all to authenticated using (true) with check (true);

-- combo_componentes: igual que combo_items (autenticado lee/escribe).
create policy "authenticated read combo_componentes" on public.combo_componentes
  for select to authenticated using (true);
create policy "authenticated write combo_componentes" on public.combo_componentes
  for all to authenticated using (true) with check (true);

-- sale_items_v2: igual que sale_items (autenticado; los inserts de la tienda
-- pública se hacen con el service role desde /api/store/order, que bypasa RLS).
create policy "authenticated read sale_items_v2" on public.sale_items_v2
  for select to authenticated using (true);
create policy "authenticated insert sale_items_v2" on public.sale_items_v2
  for insert to authenticated with check (true);
