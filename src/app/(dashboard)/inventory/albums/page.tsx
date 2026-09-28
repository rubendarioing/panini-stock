import { createClient } from '@/lib/supabase/server'
import AlbumsStockClient from './AlbumsStockClient'

export default async function AlbumsStockPage() {
  const supabase = await createClient()

  const [{ data: variantes }, { data: productos }] = await Promise.all([
    supabase
      .from('producto_variantes')
      .select(`
        *,
        inventario ( cantidad ),
        producto_variante_imagenes ( id, url, orden ),
        productos ( nombre, anio, imagen_url, categorias ( slug ), collection_types ( nombre ) )
      `)
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('productos')
      .select('*, categorias ( slug ), collection_types ( nombre )')
      .eq('activo', true)
      .order('anio', { ascending: false }),
  ])

  const albumVariantes = (variantes ?? []).filter((v: any) => v.productos?.categorias?.slug === 'album')
  const albumProductos = (productos ?? []).filter((p: any) => p.categorias?.slug === 'album')

  return <AlbumsStockClient variantes={albumVariantes} productos={albumProductos} />
}
