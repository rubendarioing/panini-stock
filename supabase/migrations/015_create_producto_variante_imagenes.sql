-- Reemplazo (no destructivo) de la tabla polimórfica `stock_imagenes`
-- (tabla text + referencia_id int, sin FK real) por una relación explícita.
-- No estaba en el documento de origen, pero es el mismo anti-patrón que el resto
-- de esta migración corrige, y stock_imagenes ya se usa activamente (soporte
-- multi-imagen agregado recientemente). stock_imagenes se mantiene intacta;
-- se migra su contenido en 018_migrate_legacy_data.sql.

create table if not exists public.producto_variante_imagenes (
  id bigint generated always as identity primary key,
  variante_id bigint not null references public.producto_variantes(id) on delete cascade,
  url text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists producto_variante_imagenes_variante_idx
  on public.producto_variante_imagenes (variante_id, orden);
