-- Permite eliminar combos desde la app.
--
-- 001_initial.sql nunca creó policy de DELETE para `combos`, así que con RLS el
-- borrado se ignoraba en silencio.
--
-- Regla: un combo con ventas registradas NO se elimina (sus combo_componentes
-- se borrarían en cascada y el detalle de esas ventas perdería qué incluía);
-- en ese caso se desactiva. Esto reemplaza la rama "con ventas -> desactivar"
-- del trigger de 031 por un error explícito.

drop policy if exists "authenticated delete combos" on public.combos;
create policy "authenticated delete combos" on public.combos
  for delete to authenticated using (true);

create or replace function public.sync_producto_on_combo_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variante_id bigint;
  v_producto_id bigint;
begin
  select id, producto_id into v_variante_id, v_producto_id
  from public.producto_variantes
  where legacy_table = 'combos' and legacy_id = old.id;

  if v_variante_id is not null
     and exists (select 1 from public.sale_items_v2 where variante_id = v_variante_id) then
    raise exception 'El combo "%" tiene ventas registradas y no se puede eliminar; desactívalo en su lugar.', old.nombre;
  end if;

  -- Devolver al inventario los ítems apartados.
  perform public.liberar_reserva_combo(old.id);

  if v_variante_id is not null then
    delete from public.inventario where variante_id = v_variante_id;
    delete from public.producto_variante_imagenes where variante_id = v_variante_id;
    delete from public.producto_variantes where id = v_variante_id;
    delete from public.productos where id = v_producto_id;
  end if;

  return old;
end;
$$;
