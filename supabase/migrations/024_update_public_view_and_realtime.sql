-- Ajustes a la vista pública para que StoreClient pueda replicar exactamente
-- la UI actual (nombre de torneo/colección, número de lámina, notas) sin volver
-- a exponer precio_compra.
--
-- IMPORTANTE sobre CREATE OR REPLACE VIEW: Postgres exige que las columnas
-- existentes conserven exactamente su nombre y posición; solo se pueden
-- agregar columnas nuevas al final de la lista. Por eso las columnas nuevas
-- (notas, legacy_table, legacy_id, producto_numero, coleccion_nombre) van
-- todas al final, después de las 20 columnas originales de 022, en el mismo
-- orden en que ya existían.
--
-- Este archivo es seguro de volver a ejecutar completo aunque una corrida
-- anterior se haya cortado a mitad de camino.

-- El número de lámina vivía solo concatenado dentro de productos.nombre
-- ("<álbum> - Lámina <numero>"); se extrae a una columna propia para no
-- depender de parsear strings en el frontend.
alter table public.productos add column if not exists numero text;

update public.productos p
set numero = s.numero
from public.stickers s
where p.legacy_table = 'stickers' and p.legacy_id = s.id and p.numero is null;

create or replace view public.v_producto_variantes_publico as
select
  -- columnas originales de 022, mismo nombre y mismo orden
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
  -- columnas nuevas, agregadas al final
  pv.notas,
  pv.legacy_table,
  pv.legacy_id,
  p.numero as producto_numero,
  ct.nombre as coleccion_nombre
from public.producto_variantes pv
join public.productos p on p.id = pv.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.inventario i on i.variante_id = pv.id
left join public.collection_types ct on ct.id = p.type_id;

alter view public.v_producto_variantes_publico set (security_invoker = false);
grant select on public.v_producto_variantes_publico to anon, authenticated;

-- inventario no tiene columnas sensibles (solo cantidad), a diferencia de
-- producto_variantes (que sí tiene precio_compra). Se abre lectura pública
-- directa sobre esta tabla para que Realtime (postgres_changes) pueda
-- notificar cambios de stock a la tienda pública sin autenticación —
-- Supabase Realtime aplica RLS con el rol del cliente que se suscribe.
drop policy if exists "public read inventario" on public.inventario;
create policy "public read inventario" on public.inventario for select using (true);

-- Habilitar Realtime para las tablas que reemplazan a stock_albums/
-- stock_stickers/stock_accesorios (ver 008_realtime.sql).
alter table public.inventario replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventario'
  ) then
    alter publication supabase_realtime add table public.inventario;
  end if;
end $$;
