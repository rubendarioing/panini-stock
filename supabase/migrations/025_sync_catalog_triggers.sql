-- Las pantallas de catálogo (collections/CollectionsClient, collections/stickers/
-- StickersClient) siguen escribiendo directo en `albums`/`stickers` — no se
-- reescribieron porque no manejan stock ni dinero. Para que un álbum o lámina
-- nuevo aparezca automáticamente en el modelo comercial (productos/
-- producto_variantes/inventario) sin tocar esas pantallas, se sincroniza vía
-- trigger en cada INSERT/UPDATE, igual que hizo la migración de datos inicial
-- (018_migrate_legacy_data.sql) pero de forma continua.

create or replace function public.sync_producto_from_album()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.productos (categoria_id, type_id, anio, nombre, descripcion, imagen_url, activo, legacy_table, legacy_id)
  values (
    (select id from public.categorias where slug = 'album'),
    new.type_id, new.anio, new.nombre, new.edicion, new.imagen_url, new.activo,
    'albums', new.id
  )
  on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null
  do update set
    type_id = excluded.type_id,
    anio = excluded.anio,
    nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    imagen_url = excluded.imagen_url,
    activo = excluded.activo,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_producto_from_album on public.albums;
create trigger trg_sync_producto_from_album
after insert or update on public.albums
for each row execute function public.sync_producto_from_album();

create or replace function public.sync_producto_from_sticker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_album record;
begin
  select nombre, type_id, anio into v_album from public.albums where id = new.album_id;

  insert into public.productos (categoria_id, type_id, anio, nombre, numero, descripcion, activo, legacy_table, legacy_id)
  values (
    (select id from public.categorias where slug = 'lamina'),
    v_album.type_id, v_album.anio,
    coalesce(v_album.nombre, '') || ' - Lámina ' || new.numero,
    new.numero, new.descripcion, true,
    'stickers', new.id
  )
  on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null
  do update set
    type_id = excluded.type_id,
    anio = excluded.anio,
    nombre = excluded.nombre,
    numero = excluded.numero,
    descripcion = excluded.descripcion,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_producto_from_sticker on public.stickers;
create trigger trg_sync_producto_from_sticker
after insert or update on public.stickers
for each row execute function public.sync_producto_from_sticker();
