-- Agrega las notas de cada ítem (ej. "pasta dura", "versión suiza") a
-- v_combo_componentes_publico, para distinguir variantes del mismo álbum en la
-- tarjeta del combo. Las notas ya son públicas en v_producto_variantes_publico.
--
-- CREATE OR REPLACE VIEW solo permite agregar columnas al final (ver 024).

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
  ct.nombre as coleccion_nombre,
  -- columnas nuevas, al final
  pv.notas
from public.combo_componentes cc
join public.producto_variantes combo_pv
  on combo_pv.legacy_table = 'combos' and combo_pv.legacy_id = cc.combo_id
join public.producto_variantes pv on pv.id = cc.variante_id
join public.productos p on p.id = pv.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.collection_types ct on ct.id = p.type_id
where combo_pv.activo;
