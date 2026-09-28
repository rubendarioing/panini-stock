-- Consultas de validación (solo lectura, no modifican nada).
-- Ejecutar después de 018_migrate_legacy_data.sql y ANTES de tocar el código
-- de la aplicación. Cada bloque debe dar 0 filas / diferencia 0.

-- 1. Conteo: productos migrados vs. filas legacy origen
select 'albums'           as origen, count(*) as legacy, (select count(*) from public.productos where legacy_table = 'albums') as migrados from public.albums
union all
select 'stickers',                 count(*),                 (select count(*) from public.productos where legacy_table = 'stickers')                 from public.stickers
union all
select 'combos',                   count(*),                 (select count(*) from public.productos where legacy_table = 'combos')                   from public.combos;

-- 2. Conteo: variantes migradas vs. lotes legacy origen
select 'stock_albums'     as origen, count(*) as legacy, (select count(*) from public.producto_variantes where legacy_table = 'stock_albums')     as migrados from public.stock_albums
union all
select 'stock_stickers',           count(*),                 (select count(*) from public.producto_variantes where legacy_table = 'stock_stickers')           from public.stock_stickers
union all
select 'stock_accesorios',         count(*),                 (select count(*) from public.producto_variantes where legacy_table = 'stock_accesorios')         from public.stock_accesorios
union all
select 'combos (variante 1x1)',    count(*),                 (select count(*) from public.producto_variantes where legacy_table = 'combos')                   from public.combos;

-- 3. Suma de cantidades en inventario: debe igualar la suma legacy por origen
select 'stock_albums' as origen,
  (select coalesce(sum(cantidad), 0) from public.stock_albums) as legacy_sum,
  (select coalesce(sum(i.cantidad), 0) from public.inventario i
     join public.producto_variantes pv on pv.id = i.variante_id
     where pv.legacy_table = 'stock_albums') as migrado_sum
union all
select 'stock_stickers',
  (select coalesce(sum(cantidad), 0) from public.stock_stickers),
  (select coalesce(sum(i.cantidad), 0) from public.inventario i
     join public.producto_variantes pv on pv.id = i.variante_id
     where pv.legacy_table = 'stock_stickers')
union all
select 'stock_accesorios',
  (select coalesce(sum(cantidad), 0) from public.stock_accesorios),
  (select coalesce(sum(i.cantidad), 0) from public.inventario i
     join public.producto_variantes pv on pv.id = i.variante_id
     where pv.legacy_table = 'stock_accesorios');

-- 4. combo_items sin equivalente en combo_componentes (debe dar 0 filas)
select ci.*
from public.combo_items ci
left join public.producto_variantes pv
  on (ci.tipo = 'album'     and pv.legacy_table = 'stock_albums'     and pv.legacy_id = ci.stock_album_id)
  or (ci.tipo = 'sticker'   and pv.legacy_table = 'stock_stickers'   and pv.legacy_id = ci.stock_sticker_id)
  or (ci.tipo = 'accesorio' and pv.legacy_table = 'stock_accesorios' and pv.legacy_id = ci.stock_accesorio_id)
where pv.id is null;

-- 5. sale_items sin equivalente en sale_items_v2 (debe dar 0 filas)
select si.*
from public.sale_items si
left join public.sale_items_v2 v2 on v2.legacy_table = 'sale_items' and v2.legacy_id = si.id
where v2.id is null;

-- 6. Ventas: cantidad/subtotal deben coincidir exactamente (no recalculados)
select
  (select count(*) from public.sale_items) as legacy_count,
  (select count(*) from public.sale_items_v2) as v2_count,
  (select coalesce(sum(subtotal), 0) from public.sale_items) as legacy_subtotal,
  (select coalesce(sum(subtotal), 0) from public.sale_items_v2) as v2_subtotal,
  (select coalesce(sum(cantidad), 0) from public.sale_items) as legacy_cantidad,
  (select coalesce(sum(cantidad), 0) from public.sale_items_v2) as v2_cantidad;

-- 7. Huérfanos: variantes sin fila de inventario (no debería pasar tras el paso 018)
select pv.*
from public.producto_variantes pv
left join public.inventario i on i.variante_id = pv.id
where i.id is null and pv.legacy_table in ('stock_albums', 'stock_stickers', 'stock_accesorios');
