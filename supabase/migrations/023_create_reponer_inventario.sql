-- Complemento de descontar_inventario (021): repone cantidad si una venta falla
-- a mitad de camino (ej. un item se queda sin stock después de que otro item de
-- la misma orden ya descontó el suyo). Usado por el rollback en
-- api/store/order/route.ts.

create or replace function public.reponer_inventario(p_variante_id bigint, p_cantidad integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventario
  set cantidad = cantidad + p_cantidad,
      updated_at = now()
  where variante_id = p_variante_id;
end;
$$;

revoke all on function public.reponer_inventario(bigint, integer) from public;
grant execute on function public.reponer_inventario(bigint, integer) to authenticated, service_role;
