import { createClient } from '@/lib/supabase/server'
import AccesoriosClient from './AccesoriosClient'

export default async function AccesoriosPage() {
  const supabase = await createClient()

  const [{ data: variantes }, { data: albums }] = await Promise.all([
    supabase
      .from('producto_variantes')
      .select(`
        *,
        inventario ( cantidad ),
        producto_variante_imagenes ( id, url, orden ),
        productos ( nombre, anio, imagen_url, legacy_table, legacy_id, categorias ( slug ), collection_types ( nombre ) )
      `)
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('albums')
      .select('id, nombre, anio, type_id, collection_types(nombre)')
      .eq('activo', true)
      .order('anio', { ascending: false }),
  ])

  const accesorioVariantes = (variantes ?? []).filter((v: any) =>
    v.productos?.categorias?.slug === 'sobre' || v.productos?.categorias?.slug === 'caja'
  )

  return <AccesoriosClient variantes={accesorioVariantes} albums={albums ?? []} />
}
