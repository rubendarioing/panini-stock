-- Reemplaza sale_items (tipo + referencia_id sin FK real) por sale_items_v2
-- con una única FK a producto_variantes. Conserva precio_unitario/subtotal
-- históricos tal cual estaban al momento de la venta original: NUNCA se
-- recalculan con el precio_venta actual de la variante.
-- sale_items se conserva intacta; se migra su contenido en 018_migrate_legacy_data.sql.

create table if not exists public.sale_items_v2 (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.sales(id) on delete cascade,
  variante_id bigint not null references public.producto_variantes(id),
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2), -- null para ventas legacy que no registraban costo por línea
  subtotal numeric(12,2) not null,
  legacy_table text,
  legacy_id bigint,

  constraint sale_items_v2_cantidad_ck check (cantidad > 0)
);

create index if not exists sale_items_v2_sale_idx on public.sale_items_v2 (sale_id);
create index if not exists sale_items_v2_variante_idx on public.sale_items_v2 (variante_id);

create unique index if not exists sale_items_v2_legacy_uq
  on public.sale_items_v2 (legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;
