import { createClient } from '@/lib/supabase/server'
import CombosClient from './CombosClient'

export default async function CombosPage() {
  const supabase = await createClient()

  const [{ data: combos }, { data: albumStock }, { data: stickerStock }, { data: accesorioStock }] = await Promise.all([
    supabase
      .from('combos')
      .select('*, combo_items(*), imagen_url')
      .order('nombre'),
    supabase
      .from('stock_albums')
      .select('id, cantidad, precio_venta, estado, albums(nombre, anio, collection_types(nombre))')
      .gt('cantidad', 0),
    supabase
      .from('stock_stickers')
      .select('id, cantidad, precio_venta, stickers(numero, descripcion, albums(nombre))')
      .gt('cantidad', 0),
    supabase
      .from('stock_accesorios')
      .select('id, cantidad, precio_venta, tipo, cantidad_contenido, albums(nombre, anio)')
      .gt('cantidad', 0),
  ])

  return (
    <CombosClient
      combos={combos ?? []}
      albumStock={albumStock ?? []}
      stickerStock={stickerStock ?? []}
      accesorioStock={accesorioStock ?? []}
    />
  )
}
