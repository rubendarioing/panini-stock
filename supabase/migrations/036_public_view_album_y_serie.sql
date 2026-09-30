-- Tienda: filtrar/buscar láminas por álbum y por serie (Coca-Cola, Extra
-- Stickers, Actualización…).
--
-- Sin cambios de tablas:
--   * album: productos.album_id (029) -> albums.nombre
--   * serie: stickers.categoria, columna que existía desde 001_initial.sql sin
--     uso. NULL = lámina regular; texto libre = nombre de la serie. Una serie
--     nueva solo requiere escribir su nombre al cargar las láminas en el catálogo.
--
-- CREATE OR REPLACE VIEW solo permite agregar columnas al final (ver 024): se
-- conservan las 25 columnas existentes en el mismo orden.

create or replace view public.v_producto_variantes_publico as
select
  pv.id,
  pv.producto_id,
  pv.sku,
  pv.nombre_variante,
  pv.condicion,
  pv.estado,
  pv.es_repetida,
  pv.unidades_contenidas,
  pv.precio_venta,
  pv.imagen_url,
  pv.activo,
  coalesce(i.cantidad, 0) as cantidad,
  p.nombre as producto_nombre,
  p.descripcion as producto_descripcion,
  p.imagen_url as producto_imagen_url,
  p.categoria_id,
  c.nombre as categoria_nombre,
  c.slug as categoria_slug,
  p.type_id,
  p.anio,
  pv.notas,
  pv.legacy_table,
  pv.legacy_id,
  p.numero as producto_numero,
  ct.nombre as coleccion_nombre,
  -- columnas nuevas, agregadas al final
  p.album_id,
  a.nombre as album_nombre,
  nullif(trim(s.categoria), '') as lamina_serie
from public.producto_variantes pv
join public.productos p on p.id = pv.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.inventario i on i.variante_id = pv.id
left join public.collection_types ct on ct.id = p.type_id
left join public.albums a on a.id = p.album_id
left join public.stickers s on p.legacy_table = 'stickers' and s.id = p.legacy_id;

alter view public.v_producto_variantes_publico set (security_invoker = false);
grant select on public.v_producto_variantes_publico to anon, authenticated;
