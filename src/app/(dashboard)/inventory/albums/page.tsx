import { createClient } from '@/lib/supabase/server'
import AlbumsStockClient from './AlbumsStockClient'

export default async function AlbumsStockPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: albums }] = await Promise.all([
    supabase
      .from('stock_albums')
      .select('*, albums(nombre, edicion, collections(nombre, anio))')
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('albums')
      .select('*, collections(nombre, anio)')
      .order('nombre'),
  ])

  return <AlbumsStockClient stock={stock ?? []} albums={albums ?? []} />
}
