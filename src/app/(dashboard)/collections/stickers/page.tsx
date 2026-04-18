import { createClient } from '@/lib/supabase/server'
import StickersClient from './StickersClient'

export default async function StickersCatalogPage() {
  const supabase = await createClient()

  const [{ data: albums }, { data: stickers }] = await Promise.all([
    supabase
      .from('albums')
      .select('id, nombre, anio, total_laminas, collection_types(nombre)')
      .eq('activo', true)
      .order('anio', { ascending: false }),
    supabase
      .from('stickers')
      .select('id, numero, descripcion, album_id, stock_stickers(imagen_url)')
      .order('album_id')
      .order('numero'),
  ])

  return <StickersClient albums={albums ?? []} stickers={stickers ?? []} />
}
