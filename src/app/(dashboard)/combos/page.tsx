import { createClient } from '@/lib/supabase/server'
import CombosClient from './CombosClient'

export default async function CombosPage() {
  const supabase = await createClient()

  const [{ data: combos }, { data: albumStock }, { data: stickerStock }] = await Promise.all([
    supabase
      .from('combos')
      .select('*, combo_items(*)')
      .order('nombre'),
    supabase
      .from('stock_albums')
      .select('id, cantidad, precio_venta, albums(nombre, anio, collection_types(nombre))')
      .gt('cantidad', 0),
    supabase
      .from('stock_stickers')
      .select('id, cantidad, precio_venta, stickers(numero, albums(nombre))')
      .gt('cantidad', 0),
  ])

  return <CombosClient combos={combos ?? []} albumStock={albumStock ?? []} stickerStock={stickerStock ?? []} />
}
