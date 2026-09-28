-- Vista pública de solo lectura para la tienda (StoreClient / store/page.tsx).
-- producto_variantes e inventario permanecen restringidas a 'authenticated'
-- (019_add_rls_product_model.sql) porque producto_variantes.precio_compra es
-- costo interno. Esta vista es la única superficie que el rol anon puede leer,
-- y deliberadamente excluye precio_compra, notas, usuario_id y fecha_compra.

create or replace view public.v_producto_variantes_publico as
select
  pv.id,
  pv.producto_id,
  pv.sku,
  pv.nombre_variante,
  pv.condicion,
  pv.estado,
  pv.es_repetida,
  pv.unidades_contenidas,
  pv.precio_venta,
  pv.imagen_url,
  pv.activo,
  coalesce(i.cantidad, 0) as cantidad,
  p.nombre as producto_nombre,
  p.descripcion as producto_descripcion,
  p.imagen_url as producto_imagen_url,
  p.categoria_id,
  c.nombre as categoria_nombre,
  c.slug as categoria_slug,
  p.type_id,
  p.anio
from public.producto_variantes pv
join public.productos p on p.id = pv.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.inventario i on i.variante_id = pv.id;

-- security_invoker = false (explícito): la vista se evalúa con los privilegios
-- de su dueño (el rol de las migraciones, que es dueño de las tablas base y por
-- tanto bypasa su RLS), no con los del rol que consulta. Así el anon puede leer
-- la vista sin necesitar acceso directo a producto_variantes/inventario.
alter view public.v_producto_variantes_publico set (security_invoker = false);

grant select on public.v_producto_variantes_publico to anon, authenticated;

-- Las imágenes de variante no tienen datos sensibles (ya son públicas en el
-- bucket de storage); se abre lectura pública igual que stock_imagenes hoy.
create policy "public read producto_variante_imagenes"
  on public.producto_variante_imagenes for select using (true);
