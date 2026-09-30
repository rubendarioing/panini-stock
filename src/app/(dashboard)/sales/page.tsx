import { createClient } from '@/lib/supabase/server'
import { expirarPedidosPendientes } from '@/lib/expire-orders'
import SalesClient from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  // Antes de listar, para que los pedidos abandonados ya aparezcan cancelados.
  await expirarPedidosPendientes()

  const [{ data: sales }, { data: variantes }] = await Promise.all([
    supabase
      .from('sales')
      .select(`
        *,
        sale_items_v2 (
          *,
          producto_variantes (
            estado, es_repetida, unidades_contenidas,
            productos ( nombre, anio, numero, descripcion, categorias ( nombre, slug ), collection_types ( nombre ) )
          )
        ),
        profiles ( nombre ),
        clientes ( nombre, email, telefono, ciudad, direccion )
      `)
      .order('fecha', { ascending: false })
      .limit(100),
    supabase
      .from('producto_variantes')
      .select(`
        id, estado, es_repetida, unidades_contenidas, precio_venta, legacy_table, legacy_id,
        inventario ( cantidad ),
        productos ( nombre, anio, numero, descripcion, categorias ( slug ), collection_types ( nombre ) )
      `),
  ])

  return (
    <SalesClient
      sales={sales ?? []}
      variantes={variantes ?? []}
    />
  )
}
