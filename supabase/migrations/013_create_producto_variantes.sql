-- producto_variantes: lo que realmente se compra/vende/inventaría.
--
-- DECISIÓN IMPORTANTE (leer antes de tocar esta tabla en el futuro):
-- cada fila de esta tabla corresponde 1:1 a una fila legacy de stock_albums /
-- stock_stickers / stock_accesorios, es decir, a un LOTE de compra (con su propio
-- precio_compra, condición y fecha), no a un SKU agregado. Esto es intencional:
-- preserva exactamente los datos históricos de costo/condición sin necesitar todavía
-- las tablas `compras` / `movimientos_inventario` (diferidas a una fase futura).
-- Consolidar variantes por SKU real es un cambio posterior, no parte de esta fase.

create table if not exists public.producto_variantes (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  sku text,
  nombre_variante text,
  condicion text,               -- nuevo/usado/sellado (álbumes) o libre (accesorios)
  estado text,                  -- lleno/vacio (solo álbumes)
  es_repetida boolean,          -- solo láminas
  unidades_contenidas integer,  -- ej. sobres por caja (solo sobres/cajas)
  precio_compra numeric(12,2),
  precio_venta numeric(12,2),
  imagen_url text,
  notas text,
  fecha_compra date,
  usuario_id uuid references public.profiles(id),
  activo boolean not null default true,
  legacy_table text,
  legacy_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint producto_variantes_precio_compra_ck check (precio_compra is null or precio_compra >= 0),
  constraint producto_variantes_precio_venta_ck check (precio_venta is null or precio_venta >= 0)
);

create index if not exists producto_variantes_producto_idx on public.producto_variantes (producto_id);

create unique index if not exists producto_variantes_sku_uq
  on public.producto_variantes (sku) where sku is not null;

create unique index if not exists producto_variantes_legacy_uq
  on public.producto_variantes (legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;
