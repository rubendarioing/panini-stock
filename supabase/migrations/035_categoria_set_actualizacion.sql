-- Set de actualización: plantilla con las láminas de jugadores que fueron al
-- Mundial pero no salieron en el álbum.
--
-- Solo datos, sin cambios de estructura: se maneja igual que sobres/cajas (un
-- producto por álbum vía productos.album_id + categoria_id, índice único de 029;
-- lotes/stock/imágenes en producto_variantes/inventario; unidades_contenidas =
-- láminas del set). La restricción "solo Mundiales" vive en la UI.
--
-- Las láminas sueltas del set se registran en el catálogo (`stickers`) del mismo
-- álbum con número alfanumérico (ej. U1..U20); no requieren cambios aquí.

insert into public.categorias (nombre, slug)
values ('Set de actualización', 'set_actualizacion')
on conflict do nothing;
