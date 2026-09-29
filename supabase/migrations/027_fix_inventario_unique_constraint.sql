-- PostgREST solo embebe una relación como objeto único ("uno a uno") cuando
-- detecta una restricción UNIQUE/PRIMARY KEY formal (pg_constraint), no un
-- simple índice único (pg_index). inventario_variante_uq se creó como índice
-- (014_create_inventario.sql), así que producto_variantes -> inventario
-- siempre se devolvía como arreglo [{cantidad}] en vez de objeto {cantidad},
-- rompiendo todo el código que hace `.inventario?.cantidad` (dashboard de
-- stock, checkout, etc. — todos leían 0 aunque el dato real era correcto).
--
-- Esto reutiliza el índice existente como restricción (instantáneo, no
-- reescribe la tabla).
alter table public.inventario
  add constraint inventario_variante_uq unique using index inventario_variante_uq;

notify pgrst, 'reload schema';
