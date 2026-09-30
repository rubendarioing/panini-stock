import { createClient } from '@/lib/supabase/server'
import CombosClient from './CombosClient'

const VARIANTE_FIELDS = `
  id, estado, es_repetida, unidades_contenidas, precio_venta,
  inventario ( cantidad ),
  productos ( nombre, anio, numero, descripcion, categorias ( slug ), collection_types ( nombre ) )
`

export default async function CombosPage() {
  const supabase = await createClient()

  const [{ data: combos }, { data: variantes }, { data: comboVariantes }] = await Promise.all([
    supabase
      .from('combos')
      .select(`*, combo_componentes ( variante_id, cantidad, producto_variantes ( ${VARIANTE_FIELDS} ) )`)
      .order('nombre'),
    // Todos los ítems (también sin stock) para poder armar el combo; la cantidad
    // de combos posible se calcula con el stock disponible.
    supabase
      .from('producto_variantes')
      .select(VARIANTE_FIELDS)
      .eq('activo', true)
      .or('legacy_table.is.null,legacy_table.neq.combos'),
    // Stock propio de cada combo (ver 031_combos_stock_reservado.sql).
    supabase
      .from('producto_variantes')
      .select('legacy_id, inventario ( cantidad )')
      .eq('legacy_table', 'combos'),
  ])

  const stockPorCombo = Object.fromEntries(
    (comboVariantes ?? []).map((v: any) => [v.legacy_id, v.inventario?.cantidad ?? 0])
  )

  return (
    <CombosClient
      combos={(combos ?? []).map((c: any) => ({ ...c, stock: stockPorCombo[c.id] ?? 0 }))}
      variantes={variantes ?? []}
    />
  )
}
