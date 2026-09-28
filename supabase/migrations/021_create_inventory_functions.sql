-- Descuento atómico de inventario, para reemplazar el patrón actual de
-- api/store/order/route.ts (leer cantidad, luego update sin condición ni
-- verificación de filas afectadas), que permite sobrevender bajo pedidos
-- concurrentes desde la tienda pública.
--
-- Uso desde el backend (Fase 2, en vez del select+update actual):
--   const { data: ok } = await supabase.rpc('descontar_inventario', {
--     p_variante_id: variante.id, p_cantidad: cantidad
--   })
--   if (!ok) { /* stock insuficiente, abortar esta línea del pedido */ }

create or replace function public.descontar_inventario(p_variante_id bigint, p_cantidad integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.inventario
  set cantidad = cantidad - p_cantidad,
      updated_at = now()
  where variante_id = p_variante_id
    and cantidad >= p_cantidad;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.descontar_inventario(bigint, integer) from public;
grant execute on function public.descontar_inventario(bigint, integer) to authenticated, service_role;
