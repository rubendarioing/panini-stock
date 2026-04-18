import { createClient } from '@/lib/supabase/server'
import AlbumsStockClient from './AlbumsStockClient'

export default async function AlbumsStockPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: albums }] = await Promise.all([
    supabase
      .from('stock_albums')
      .select('*, albums(nombre, edicion, anio, imagen_url, collection_types(nombre))')
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('albums')
      .select('*, collection_types(nombre)')
      .eq('activo', true)
      .order('anio', { ascending: false }),
  ])

  return <AlbumsStockClient stock={stock ?? []} albums={albums ?? []} />
}
