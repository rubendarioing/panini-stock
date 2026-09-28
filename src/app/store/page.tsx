import { createClient } from '@/lib/supabase/server'
import StoreClient from './StoreClient'

export default async function StorePage() {
  const supabase = await createClient()

  const [
    { data: variantes },
    { data: collectionTypes },
    { data: varianteImagenes },
  ] = await Promise.all([
    supabase
      .from('v_producto_variantes_publico')
      .select('*')
      .eq('activo', true)
      .order('id'),
    supabase
      .from('collection_types')
      .select('*')
      .order('nombre'),
    supabase
      .from('producto_variante_imagenes')
      .select('variante_id, url, orden')
      .order('orden'),
  ])

  return (
    <StoreClient
      variantes={variantes ?? []}
      collectionTypes={collectionTypes ?? []}
      varianteImagenes={varianteImagenes ?? []}
    />
  )
}
