-- Elimina las tablas legacy reemplazadas por el modelo unificado (011..029):
--   stock_albums / stock_stickers / stock_accesorios -> producto_variantes + inventario
--   stock_imagenes                                   -> producto_variante_imagenes
--   sale_items                                       -> sale_items_v2
--   combo_items                                      -> combo_componentes
--
-- Verificado antes de escribir esta migración: las 6 tablas tenían 0 filas y ni
-- el código ni funciones/vistas/triggers de la base las referenciaban (solo las
-- consultas de validación de un solo uso en 020_validation_queries.sql).
--
-- Los valores 'stock_albums' / 'stock_stickers' / 'stock_accesorios' / 'sale_items'
-- que quedan en producto_variantes.legacy_table y sale_items_v2.legacy_table son
-- solo texto de trazabilidad y se conservan.
--
-- Sin CASCADE a propósito: si algo inesperado aún depende de estas tablas, la
-- migración falla en lugar de borrarlo en silencio. Se aborta también si alguna
-- tabla recibió filas desde la verificación.

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['combo_items', 'sale_items', 'stock_imagenes', 'stock_stickers', 'stock_accesorios', 'stock_albums'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'La tabla % tiene % fila(s); revisar antes de eliminarla', t, n;
      end if;
    end if;
  end loop;
end;
$$;

-- Orden: primero las que tienen FK hacia las demás.
drop table if exists public.combo_items;
drop table if exists public.sale_items;
drop table if exists public.stock_imagenes;
drop table if exists public.stock_stickers;
drop table if exists public.stock_accesorios;
drop table if exists public.stock_albums;
