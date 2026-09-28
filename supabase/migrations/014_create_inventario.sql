-- inventario: cantidad disponible por variante. Una sola ubicación por ahora
-- (unique en variante_id); si en el futuro hay varias bodegas, agregar
-- `ubicaciones` y cambiar el unique a (variante_id, ubicacion_id).

create table if not exists public.inventario (
  id bigint generated always as identity primary key,
  variante_id bigint not null references public.producto_variantes(id),
  cantidad integer not null default 0,
  updated_at timestamptz not null default now(),

  constraint inventario_cantidad_ck check (cantidad >= 0)
);

create unique index if not exists inventario_variante_uq on public.inventario (variante_id);
