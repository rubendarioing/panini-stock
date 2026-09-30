-- Relación real productos -> albums.
--
-- Hasta ahora el álbum de un producto solo se podía deducir vía legacy_table/
-- legacy_id, y para sobres/cajas esas columnas se usaban como clave de negocio
-- (legacy_table = 'stock_accesorios_<tipo>', legacy_id = <id del álbum>), sin FK.
-- Eso impedía que borrar un álbum limpiara sus productos de sobre/caja (028
-- solo encuentra productos con legacy_table = 'albums').
--
-- Con album_id:
--   * álbum      -> album_id = su propio álbum
--   * lámina     -> album_id = stickers.album_id
--   * sobre/caja -> album_id = álbum al que pertenecen (identificados por
--                   album_id + categoria_id, ya no por legacy_*)
--   * combo      -> album_id = null
--
-- Seguro de volver a ejecutar completo.

alter table public.productos
  add column if not exists album_id int references public.albums(id) on delete set null;

create index if not exists productos_album_idx on public.productos (album_id);

-- =============================================
-- Backfill
-- =============================================
update public.productos
set album_id = legacy_id
where album_id is null
  and legacy_table in ('albums', 'stock_accesorios_sobre', 'stock_accesorios_caja');

update public.productos p
set album_id = s.album_id
from public.stickers s
where p.album_id is null
  and p.legacy_table = 'stickers' and p.legacy_id = s.id;

-- Sobres/cajas: legacy_id guardaba un id de álbum, no el id de una fila legacy.
-- Esa información ya vive en album_id + categoria_id, así que se libera legacy_*
-- para que vuelva a significar solo "trazabilidad hacia la fila de origen".
update public.productos
set legacy_table = null, legacy_id = null
where legacy_table in ('stock_accesorios_sobre', 'stock_accesorios_caja');

-- Un solo producto "Álbum", "Sobre" y "Caja" por álbum (las láminas llevan
-- numero y quedan fuera del índice).
create unique index if not exists productos_album_categoria_uq
  on public.productos (album_id, categoria_id)
  where album_id is not null and numero is null;

-- =============================================
-- Sync INSERT/UPDATE (reemplaza las funciones de 025 agregando album_id)
-- =============================================
create or replace function public.sync_producto_from_album()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.productos (categoria_id, type_id, anio, nombre, descripcion, imagen_url, activo, album_id, legacy_table, legacy_id)
  values (
    (select id from public.categorias where slug = 'album'),
    new.type_id, new.anio, new.nombre, new.edicion, new.imagen_url, new.activo,
    new.id,
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
    album_id = excluded.album_id,
    updated_at = now();
  return new;
end;
$$;

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

  insert into public.productos (categoria_id, type_id, anio, nombre, numero, descripcion, activo, album_id, legacy_table, legacy_id)
  values (
    (select id from public.categorias where slug = 'lamina'),
    v_album.type_id, v_album.anio,
    coalesce(v_album.nombre, '') || ' - Lámina ' || new.numero,
    new.numero, new.descripcion, true,
    new.album_id,
    'stickers', new.id
  )
  on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null
  do update set
    type_id = excluded.type_id,
    anio = excluded.anio,
    nombre = excluded.nombre,
    numero = excluded.numero,
    descripcion = excluded.descripcion,
    album_id = excluded.album_id,
    updated_at = now();
  return new;
end;
$$;

-- =============================================
-- DELETE de álbum: cubre álbum, láminas y sobres/cajas vía album_id.
-- Reemplaza el trigger de álbumes de 028 (el de stickers se mantiene).
-- Es BEFORE porque la FK (on delete set null) vacía album_id antes de que
-- corra cualquier trigger AFTER.
-- Mismo criterio que 028: sin variantes se borra; con variantes se desactiva
-- para no romper historial de compras/ventas.
-- =============================================
create or replace function public.sync_productos_on_album_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.productos p
  set activo = false, updated_at = now()
  where p.album_id = old.id
    and exists (select 1 from public.producto_variantes v where v.producto_id = p.id);

  delete from public.productos p
  where p.album_id = old.id
    and not exists (select 1 from public.producto_variantes v where v.producto_id = p.id);

  return old;
end;
$$;

drop trigger if exists trg_sync_producto_on_album_delete on public.albums;
drop trigger if exists trg_sync_productos_on_album_delete on public.albums;
create trigger trg_sync_productos_on_album_delete
before delete on public.albums
for each row execute function public.sync_productos_on_album_delete();

-- Validación rápida (debe devolver 0 filas): productos de álbum/lámina/sobre/caja sin album_id.
-- select p.id, p.nombre, c.slug from public.productos p join public.categorias c on c.id = p.categoria_id
-- where c.slug in ('album', 'lamina', 'sobre', 'caja') and p.album_id is null and p.activo;
