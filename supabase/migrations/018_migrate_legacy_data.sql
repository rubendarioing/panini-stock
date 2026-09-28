-- Migración de datos legacy -> modelo unificado. Idempotente: usa los índices
-- únicos (legacy_table, legacy_id) creados en 011-017, así que puede re-ejecutarse
-- sin duplicar filas si se corta a mitad de camino.
--
-- No borra ni modifica ninguna tabla legacy. Ejecutar 020_validation_queries.sql
-- después de correr este archivo y ANTES de tocar el código de la aplicación.

begin;

-- =============================================
-- 1. albums -> productos (categoria = Álbum)
-- =============================================
insert into public.productos (categoria_id, type_id, anio, nombre, descripcion, imagen_url, activo, legacy_table, legacy_id)
select
  (select id from public.categorias where slug = 'album'),
  a.type_id,
  a.anio,
  a.nombre,
  a.edicion,
  a.imagen_url,
  a.activo,
  'albums',
  a.id
from public.albums a
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

-- =============================================
-- 2. stock_albums -> producto_variantes + inventario
-- =============================================
insert into public.producto_variantes (
  producto_id, condicion, estado, precio_compra, precio_venta,
  imagen_url, notas, fecha_compra, usuario_id, legacy_table, legacy_id
)
select
  p.id, sa.condicion, sa.estado, sa.precio_compra, sa.precio_venta,
  sa.imagen_url, sa.notas, sa.fecha_compra, sa.usuario_id, 'stock_albums', sa.id
from public.stock_albums sa
join public.productos p on p.legacy_table = 'albums' and p.legacy_id = sa.album_id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

insert into public.inventario (variante_id, cantidad)
select pv.id, sa.cantidad
from public.stock_albums sa
join public.producto_variantes pv on pv.legacy_table = 'stock_albums' and pv.legacy_id = sa.id
on conflict (variante_id) do nothing;

-- =============================================
-- 3. stickers -> productos (categoria = Lámina, uno por lámina)
-- =============================================
insert into public.productos (categoria_id, type_id, anio, nombre, descripcion, activo, legacy_table, legacy_id)
select
  (select id from public.categorias where slug = 'lamina'),
  al.type_id, al.anio,
  al.nombre || ' - Lámina ' || s.numero,
  s.descripcion,
  true,
  'stickers', s.id
from public.stickers s
join public.albums al on al.id = s.album_id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

-- =============================================
-- 4. stock_stickers -> producto_variantes + inventario
-- =============================================
insert into public.producto_variantes (
  producto_id, es_repetida, precio_compra, precio_venta, imagen_url, notas,
  fecha_compra, usuario_id, legacy_table, legacy_id
)
select
  p.id, ss.es_repetida, ss.precio_compra, ss.precio_venta, ss.imagen_url, ss.notas,
  ss.fecha_compra, ss.usuario_id, 'stock_stickers', ss.id
from public.stock_stickers ss
join public.productos p on p.legacy_table = 'stickers' and p.legacy_id = ss.sticker_id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

insert into public.inventario (variante_id, cantidad)
select pv.id, ss.cantidad
from public.stock_stickers ss
join public.producto_variantes pv on pv.legacy_table = 'stock_stickers' and pv.legacy_id = ss.id
on conflict (variante_id) do nothing;

-- =============================================
-- 5. stock_accesorios -> productos sintéticos (Sobre/Caja por álbum) + variantes + inventario
-- =============================================
insert into public.productos (categoria_id, type_id, anio, nombre, activo, legacy_table, legacy_id)
select distinct
  (select id from public.categorias where slug = sa.tipo),
  al.type_id, al.anio,
  al.nombre || ' - ' || initcap(sa.tipo),
  true,
  'stock_accesorios_' || sa.tipo,
  al.id
from public.stock_accesorios sa
join public.albums al on al.id = sa.album_id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

insert into public.producto_variantes (
  producto_id, condicion, unidades_contenidas, precio_compra, precio_venta,
  imagen_url, notas, fecha_compra, usuario_id, legacy_table, legacy_id
)
select
  p.id, sa.condicion, sa.cantidad_contenido, sa.precio_compra, sa.precio_venta,
  sa.imagen_url, sa.notas, sa.fecha_compra, sa.usuario_id, 'stock_accesorios', sa.id
from public.stock_accesorios sa
join public.productos p
  on p.legacy_table = 'stock_accesorios_' || sa.tipo and p.legacy_id = sa.album_id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

insert into public.inventario (variante_id, cantidad)
select pv.id, sa.cantidad
from public.stock_accesorios sa
join public.producto_variantes pv on pv.legacy_table = 'stock_accesorios' and pv.legacy_id = sa.id
on conflict (variante_id) do nothing;

-- =============================================
-- 6. combos -> productos (categoria = Combo) + una variante por combo
--    (solo para que sale_items_v2 tenga una FK válida; no implica todavía
--    gestionar combos como producto en la UI, eso es un paso posterior)
-- =============================================
insert into public.productos (categoria_id, nombre, descripcion, imagen_url, activo, legacy_table, legacy_id)
select
  (select id from public.categorias where slug = 'combo'),
  c.nombre, c.descripcion, c.imagen_url, c.activo, 'combos', c.id
from public.combos c
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

insert into public.producto_variantes (producto_id, precio_venta, activo, legacy_table, legacy_id)
select p.id, c.precio_total, c.activo, 'combos', c.id
from public.combos c
join public.productos p on p.legacy_table = 'combos' and p.legacy_id = c.id
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

-- =============================================
-- 7. combo_items -> combo_componentes
-- =============================================
insert into public.combo_componentes (combo_id, variante_id, cantidad)
select
  ci.combo_id,
  pv.id,
  ci.cantidad
from public.combo_items ci
join public.producto_variantes pv
  on (ci.tipo = 'album'     and pv.legacy_table = 'stock_albums'     and pv.legacy_id = ci.stock_album_id)
  or (ci.tipo = 'sticker'   and pv.legacy_table = 'stock_stickers'   and pv.legacy_id = ci.stock_sticker_id)
  or (ci.tipo = 'accesorio' and pv.legacy_table = 'stock_accesorios' and pv.legacy_id = ci.stock_accesorio_id)
on conflict (combo_id, variante_id) do nothing;

-- =============================================
-- 8. sale_items -> sale_items_v2
-- =============================================
insert into public.sale_items_v2 (sale_id, variante_id, cantidad, precio_unitario, subtotal, legacy_table, legacy_id)
select
  si.sale_id,
  pv.id,
  si.cantidad,
  si.precio_unitario,
  si.subtotal,
  'sale_items',
  si.id
from public.sale_items si
join public.producto_variantes pv
  on (si.tipo = 'album'     and pv.legacy_table = 'stock_albums'     and pv.legacy_id = si.referencia_id)
  or (si.tipo = 'sticker'   and pv.legacy_table = 'stock_stickers'   and pv.legacy_id = si.referencia_id)
  or (si.tipo = 'accesorio' and pv.legacy_table = 'stock_accesorios' and pv.legacy_id = si.referencia_id)
  or (si.tipo = 'combo'     and pv.legacy_table = 'combos'           and pv.legacy_id = si.referencia_id)
on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null do nothing;

-- =============================================
-- 9. stock_imagenes -> producto_variante_imagenes
-- =============================================
insert into public.producto_variante_imagenes (variante_id, url, orden)
select pv.id, si.url, si.orden
from public.stock_imagenes si
join public.producto_variantes pv
  on pv.legacy_table = si.tabla and pv.legacy_id = si.referencia_id;

commit;
