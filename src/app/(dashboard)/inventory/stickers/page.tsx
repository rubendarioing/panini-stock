import { createClient } from '@/lib/supabase/server'
import StickersStockClient from './StickersStockClient'

export default async function StickersStockPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: stickers }] = await Promise.all([
    supabase
      .from('stock_stickers')
      .select('*, imagen_url, stickers(numero, descripcion, album_id, albums(nombre, anio, collection_types(nombre)))')
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('stickers')
      .select('id, numero, descripcion, album_id, albums(nombre, anio, collection_types(nombre))')
      .order('album_id')
      .order('numero'),
  ])

  return <StickersStockClient stock={stock ?? []} stickers={stickers ?? []} />
}
