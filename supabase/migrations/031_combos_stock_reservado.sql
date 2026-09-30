-- Combos con stock propio y reserva de componentes.
--
-- Problemas que corrige:
--   1. Los combos creados después de 018 nunca obtenían su productos/
--      producto_variantes (la migración de datos fue de una sola vez y no había
--      trigger), así que no aparecían en la tienda ni en ventas.
--   2. Un combo no tenía cantidad: la tienda lo mostraba con stock "infinito"
--      (999) y el stock de los componentes se validaba recién al comprar.
--
-- Modelo (reserva):
--   * Cada combo tiene una variante (legacy_table = 'combos') con su propia fila
--     de inventario = cuántos combos armados hay disponibles.
--   * Al fijar la cantidad N, se descuenta N × cantidad de cada componente de su
--     inventario (los ítems quedan apartados y no se venden sueltos).
--   * Vender un combo descuenta solo el inventario del combo (flujo normal de
--     descontar_inventario sobre la variante del combo).
--   * Bajar la cantidad, desactivar o borrar el combo devuelve los ítems.
--
-- Seguro de volver a ejecutar completo.

-- =============================================
-- Sync combos -> productos / producto_variantes / inventario
-- =============================================
create or replace function public.sync_producto_from_combo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id bigint;
  v_variante_id bigint;
begin
  insert into public.productos (categoria_id, nombre, descripcion, imagen_url, activo, legacy_table, legacy_id)
  values (
    (select id from public.categorias where slug = 'combo'),
    new.nombre, new.descripcion, new.imagen_url, new.activo, 'combos', new.id
  )
  on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null
  do update set
    nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    imagen_url = excluded.imagen_url,
    activo = excluded.activo,
    updated_at = now()
  returning id into v_producto_id;

  insert into public.producto_variantes (producto_id, precio_venta, activo, legacy_table, legacy_id)
  values (v_producto_id, new.precio_total, new.activo, 'combos', new.id)
  on conflict (legacy_table, legacy_id) where legacy_table is not null and legacy_id is not null
  do update set
    producto_id = excluded.producto_id,
    precio_venta = excluded.precio_venta,
    activo = excluded.activo,
    updated_at = now()
  returning id into v_variante_id;

  insert into public.inventario (variante_id, cantidad)
  values (v_variante_id, 0)
  on conflict (variante_id) do nothing;

  -- Desactivar un combo devuelve los ítems apartados.
  if tg_op = 'UPDATE' and old.activo and not new.activo then
    perform public.liberar_reserva_combo(new.id);
  end if;

  return new;
end;
$$;

-- =============================================
-- Devuelve al inventario los ítems apartados por un combo y deja su stock en 0.
-- =============================================
create or replace function public.liberar_reserva_combo(p_combo_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variante_id bigint;
  v_actual integer;
  r record;
begin
  select id into v_variante_id
  from public.producto_variantes
  where legacy_table = 'combos' and legacy_id = p_combo_id;

  if v_variante_id is null then
    return;
  end if;

  -- Bloquea el stock del combo: una venta concurrente espera a que termine.
  select cantidad into v_actual
  from public.inventario
  where variante_id = v_variante_id
  for update;

  v_actual := coalesce(v_actual, 0);
  if v_actual <= 0 then
    return;
  end if;

  for r in select variante_id, cantidad from public.combo_componentes where combo_id = p_combo_id loop
    perform public.reponer_inventario(r.variante_id, r.cantidad * v_actual);
  end loop;

  update public.inventario set cantidad = 0, updated_at = now() where variante_id = v_variante_id;
end;
$$;

revoke all on function public.liberar_reserva_combo(bigint) from public;

-- =============================================
-- Guarda componentes + cantidad de un combo en una sola transacción.
-- p_componentes: [{"variante_id": 23, "cantidad": 1}, ...]
-- Si algún componente no alcanza, lanza excepción y no cambia nada.
-- =============================================
create or replace function public.guardar_combo(p_combo_id bigint, p_componentes jsonb, p_cantidad integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_combo record;
  v_variante_id bigint;
  v_disponible integer;
  r record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La cantidad de combos no puede ser negativa';
  end if;

  select id, activo into v_combo from public.combos where id = p_combo_id;
  if v_combo.id is null then
    raise exception 'El combo % no existe', p_combo_id;
  end if;
  if not v_combo.activo and p_cantidad > 0 then
    raise exception 'Activa el combo antes de asignarle cantidad';
  end if;

  select id into v_variante_id
  from public.producto_variantes
  where legacy_table = 'combos' and legacy_id = p_combo_id;
  if v_variante_id is null then
    raise exception 'El combo % no tiene producto asociado', p_combo_id;
  end if;

  -- 1. Devolver lo que estaba apartado con los componentes anteriores.
  perform public.liberar_reserva_combo(p_combo_id);

  -- 2. Reemplazar componentes (agrupando duplicados).
  delete from public.combo_componentes where combo_id = p_combo_id;

  insert into public.combo_componentes (combo_id, variante_id, cantidad)
  select p_combo_id, (e->>'variante_id')::bigint, sum((e->>'cantidad')::integer)
  from jsonb_array_elements(coalesce(p_componentes, '[]'::jsonb)) e
  group by (e->>'variante_id')::bigint;

  if exists (
    select 1
    from public.combo_componentes cc
    join public.producto_variantes pv on pv.id = cc.variante_id
    where cc.combo_id = p_combo_id and pv.legacy_table = 'combos'
  ) then
    raise exception 'Un combo no puede contener otro combo';
  end if;

  -- 3. Apartar los ítems para la nueva cantidad.
  if p_cantidad > 0 then
    if not exists (select 1 from public.combo_componentes where combo_id = p_combo_id) then
      raise exception 'Agrega al menos un ítem antes de asignar cantidad al combo';
    end if;

    for r in
      select cc.variante_id, cc.cantidad, p.nombre
      from public.combo_componentes cc
      join public.producto_variantes pv on pv.id = cc.variante_id
      join public.productos p on p.id = pv.producto_id
      where cc.combo_id = p_combo_id
    loop
      if not public.descontar_inventario(r.variante_id, r.cantidad * p_cantidad) then
        select coalesce(cantidad, 0) into v_disponible from public.inventario where variante_id = r.variante_id;
        raise exception 'Stock insuficiente para "%": se necesitan %, hay %',
          r.nombre, r.cantidad * p_cantidad, coalesce(v_disponible, 0);
      end if;
    end loop;
  end if;

  insert into public.inventario (variante_id, cantidad)
  values (v_variante_id, p_cantidad)
  on conflict (variante_id) do update set cantidad = excluded.cantidad, updated_at = now();
end;
$$;

revoke all on function public.guardar_combo(bigint, jsonb, integer) from public;
grant execute on function public.guardar_combo(bigint, jsonb, integer) to authenticated;

-- =============================================
-- DELETE de combo: devolver ítems y limpiar su producto (mismo criterio que
-- 028: con historial de ventas se desactiva, sin historial se borra).
-- BEFORE para que combo_componentes aún exista (se borra en cascada).
-- =============================================
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
  perform public.liberar_reserva_combo(old.id);

  select id, producto_id into v_variante_id, v_producto_id
  from public.producto_variantes
  where legacy_table = 'combos' and legacy_id = old.id;

  if v_variante_id is null then
    return old;
  end if;

  if exists (select 1 from public.sale_items_v2 where variante_id = v_variante_id) then
    update public.producto_variantes set activo = false, updated_at = now() where id = v_variante_id;
    update public.productos set activo = false, updated_at = now() where id = v_producto_id;
  else
    delete from public.inventario where variante_id = v_variante_id;
    delete from public.producto_variante_imagenes where variante_id = v_variante_id;
    delete from public.producto_variantes where id = v_variante_id;
    delete from public.productos where id = v_producto_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_sync_producto_from_combo on public.combos;
create trigger trg_sync_producto_from_combo
after insert or update on public.combos
for each row execute function public.sync_producto_from_combo();

drop trigger if exists trg_sync_producto_on_combo_delete on public.combos;
create trigger trg_sync_producto_on_combo_delete
before delete on public.combos
for each row execute function public.sync_producto_on_combo_delete();

-- =============================================
-- Backfill: crear producto/variante/inventario de los combos que no lo tienen.
-- (activo = activo dispara el trigger sin cambiar nada; no libera reservas
-- porque old.activo = new.activo).
-- =============================================
update public.combos c
set activo = c.activo
where not exists (
  select 1 from public.producto_variantes pv
  where pv.legacy_table = 'combos' and pv.legacy_id = c.id
);
