-- Reemplaza el patrón polimórfico de combo_items
-- (tipo + stock_album_id + stock_sticker_id + stock_accesorio_id)
-- por una única FK a producto_variantes. combo_items se conserva intacta;
-- se migra su contenido en 018_migrate_legacy_data.sql.

create table if not exists public.combo_componentes (
  id bigint generated always as identity primary key,
  combo_id bigint not null references public.combos(id) on delete cascade,
  variante_id bigint not null references public.producto_variantes(id),
  cantidad integer not null,

  constraint combo_componentes_cantidad_ck check (cantidad > 0)
);

create index if not exists combo_componentes_combo_idx on public.combo_componentes (combo_id);
create index if not exists combo_componentes_variante_idx on public.combo_componentes (variante_id);

-- Evita duplicar el mismo componente en el mismo combo si la migración de datos se re-ejecuta.
create unique index if not exists combo_componentes_combo_variante_uq
  on public.combo_componentes (combo_id, variante_id);
