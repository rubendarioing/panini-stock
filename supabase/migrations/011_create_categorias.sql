-- Fase 1 del modelo unificado producto/variante/inventario.
-- No borra ni modifica tablas legacy (albums, stickers, stock_albums, stock_stickers,
-- stock_accesorios, combos, combo_items, sale_items). Ver 018_migrate_legacy_data.sql.

create table if not exists public.categorias (
  id bigint generated always as identity primary key,
  nombre text not null,
  slug text,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categorias_nombre_uq on public.categorias (lower(nombre));
create unique index if not exists categorias_slug_uq on public.categorias (slug) where slug is not null;

-- Solo las categorías que ya existen como datos reales hoy (albums/sobre-caja/láminas/combos).
-- Nuevas categorías (manga, cómic, trading card, etc.) se agregan con INSERT, sin migración de esquema.
insert into public.categorias (nombre, slug) values
  ('Álbum', 'album'),
  ('Sobre', 'sobre'),
  ('Caja', 'caja'),
  ('Lámina', 'lamina'),
  ('Combo', 'combo')
on conflict do nothing;
