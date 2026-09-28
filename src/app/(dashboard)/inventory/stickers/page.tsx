import { createClient } from '@/lib/supabase/server'
import StickersStockClient from './StickersStockClient'

export default async function StickersStockPage() {
  const supabase = await createClient()

  const [{ data: variantes }, { data: stickers }, { data: productos }] = await Promise.all([
    supabase
      .from('producto_variantes')
      .select(`
        *,
        inventario ( cantidad ),
        producto_variante_imagenes ( id, url, orden ),
        productos ( nombre, numero, descripcion, anio, categorias ( slug ), collection_types ( nombre ) )
      `)
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('stickers')
      .select('id, numero, descripcion, album_id, albums(nombre, anio, collection_types(nombre))')
      .order('album_id')
      .order('numero'),
    supabase
      .from('productos')
      .select('id, legacy_id')
      .eq('legacy_table', 'stickers'),
  ])

  const laminaVariantes = (variantes ?? []).filter((v: any) => v.productos?.categorias?.slug === 'lamina')
  const stickerProductoMap = Object.fromEntries((productos ?? []).map((p: any) => [p.legacy_id, p.id]))
  const productoStickerMap = Object.fromEntries((productos ?? []).map((p: any) => [p.id, p.legacy_id]))

  return (
    <StickersStockClient
      variantes={laminaVariantes}
      stickers={stickers ?? []}
      stickerProductoMap={stickerProductoMap}
      productoStickerMap={productoStickerMap}
    />
  )
}
