-- productos: concepto de producto (álbum, sobre, caja, lámina o combo), independiente
-- del tipo físico. type_id/anio se heredan directo de `albums` (misma decisión de
-- aplanamiento que ya tomó 003_remove_collections.sql) en vez de crear una tabla
-- `colecciones` separada: no hay hoy un caso de negocio que la necesite.

create table if not exists public.productos (
  id bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias(id),
  type_id int references public.collection_types(id),
  anio int,
  nombre text not null,
  descripcion text,
  imagen_url text,
  activo boolean not null default true,
  -- trazabilidad hacia la tabla legacy de origen (ver sección 16 del plan de migración)
  legacy_table text,
  legacy_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists productos_categoria_idx on public.productos (categoria_id);
create index if not exists productos_type_idx on public.productos (type_id);

create unique index if not exists productos_legacy_uq
  on public.productos (legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;
