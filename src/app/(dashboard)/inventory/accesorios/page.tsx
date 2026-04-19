import { createClient } from '@/lib/supabase/server'
import AccesoriosClient from './AccesoriosClient'

export default async function AccesoriosPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: albums }] = await Promise.all([
    supabase
      .from('stock_accesorios')
      .select('*, albums(nombre, anio, imagen_url, collection_types(nombre))')
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('albums')
      .select('id, nombre, anio, collection_types(nombre)')
      .eq('activo', true)
      .order('anio', { ascending: false }),
  ])

  return <AccesoriosClient stock={stock ?? []} albums={albums ?? []} />
}
