-- 025_sync_catalog_triggers.sql solo sincroniza INSERT/UPDATE de `albums`/`stickers`
-- hacia `productos`. Como productos.legacy_id no es una FK real (es trazabilidad
-- polimórfica legacy_table + legacy_id), borrar un álbum o lámina del catálogo
-- dejaba el producto huérfano (ej. productos.id 742 -> stickers.id 728).
--
-- Al borrar en el catálogo:
--   * si el producto no tiene variantes, se elimina;
--   * si tiene variantes (lotes con historial de compras/ventas que referencian
--     producto_variantes sin cascade), se desactiva en vez de borrarse, para no
--     romper ese historial.

create or replace function public.sync_producto_on_catalog_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id bigint;
begin
  select id into v_producto_id
  from public.productos
  where legacy_table = tg_table_name and legacy_id = old.id;

  if v_producto_id is null then
    return old;
  end if;

  if exists (select 1 from public.producto_variantes where producto_id = v_producto_id) then
    update public.productos set activo = false, updated_at = now() where id = v_producto_id;
  else
    delete from public.productos where id = v_producto_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_sync_producto_on_sticker_delete on public.stickers;
create trigger trg_sync_producto_on_sticker_delete
after delete on public.stickers
for each row execute function public.sync_producto_on_catalog_delete();

drop trigger if exists trg_sync_producto_on_album_delete on public.albums;
create trigger trg_sync_producto_on_album_delete
after delete on public.albums
for each row execute function public.sync_producto_on_catalog_delete();

-- Limpieza de huérfanos ya existentes (mismo criterio que el trigger).
update public.productos p
set activo = false, updated_at = now()
where p.legacy_table in ('stickers', 'albums')
  and p.activo
  and not exists (
    select 1 from public.stickers s where p.legacy_table = 'stickers' and s.id = p.legacy_id
    union all
    select 1 from public.albums a where p.legacy_table = 'albums' and a.id = p.legacy_id
  )
  and exists (select 1 from public.producto_variantes v where v.producto_id = p.id);

delete from public.productos p
where p.legacy_table in ('stickers', 'albums')
  and not exists (
    select 1 from public.stickers s where p.legacy_table = 'stickers' and s.id = p.legacy_id
    union all
    select 1 from public.albums a where p.legacy_table = 'albums' and a.id = p.legacy_id
  )
  and not exists (select 1 from public.producto_variantes v where v.producto_id = p.id);
