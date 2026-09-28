import { createClient } from '@/lib/supabase/server'
import CombosClient from './CombosClient'

export default async function CombosPage() {
  const supabase = await createClient()

  const [{ data: combos }, { data: variantes }] = await Promise.all([
    supabase
      .from('combos')
      .select('*, combo_componentes(*)')
      .order('nombre'),
    supabase
      .from('producto_variantes')
      .select(`
        id, estado, es_repetida, unidades_contenidas, precio_venta,
        inventario!inner ( cantidad ),
        productos ( nombre, anio, numero, descripcion, categorias ( slug ), collection_types ( nombre ) )
      `)
      .gt('inventario.cantidad', 0),
  ])

  return (
    <CombosClient
      combos={combos ?? []}
      variantes={variantes ?? []}
    />
  )
}
