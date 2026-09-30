import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { expirarPedidosPendientes } from '@/lib/expire-orders'
import StoreClient from './StoreClient'

export default async function StorePage() {
  const supabase = await createClient()

  // Libera stock de pedidos abandonados sin demorar la página (se verá en la
  // siguiente carga o por Realtime).
  after(() => expirarPedidosPendientes())

  const [
    { data: variantes },
    { data: collectionTypes },
    { data: varianteImagenes },
    { data: comboComponentes },
  ] = await Promise.all([
    supabase
      .from('v_producto_variantes_publico')
      .select('*')
      .eq('activo', true)
      .order('id'),
    supabase
      .from('collection_types')
      .select('*')
      .order('nombre'),
    supabase
      .from('producto_variante_imagenes')
      .select('variante_id, url, orden')
      .order('orden'),
    supabase
      .from('v_combo_componentes_publico')
      .select('*'),
  ])

  return (
    <StoreClient
      variantes={variantes ?? []}
      collectionTypes={collectionTypes ?? []}
      varianteImagenes={varianteImagenes ?? []}
      comboComponentes={comboComponentes ?? []}
    />
  )
}
