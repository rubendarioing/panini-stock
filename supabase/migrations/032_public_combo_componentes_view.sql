-- Ítems de cada combo para la tienda pública.
--
-- combo_componentes y producto_variantes solo son legibles por usuarios
-- autenticados (019), así que la tienda (anon) no podía mostrar qué incluye un
-- combo. Igual que v_producto_variantes_publico (022/024), esta vista expone
-- solo datos de catálogo, nunca precio_compra.

create or replace view public.v_combo_componentes_publico as
select
  combo_pv.id as combo_variante_id,
  cc.cantidad,
  pv.estado,
  pv.es_repetida,
  pv.unidades_contenidas,
  p.nombre as producto_nombre,
  p.anio,
  p.numero as producto_numero,
  p.descripcion as producto_descripcion,
  c.slug as categoria_slug,
  ct.nombre as coleccion_nombre
from public.combo_componentes cc
join public.producto_variantes combo_pv
  on combo_pv.legacy_table = 'combos' and combo_pv.legacy_id = cc.combo_id
join public.producto_variantes pv on pv.id = cc.variante_id
join public.productos p on p.id = pv.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.collection_types ct on ct.id = p.type_id
where combo_pv.activo;

alter view public.v_combo_componentes_publico set (security_invoker = false);
grant select on public.v_combo_componentes_publico to anon, authenticated;
