import { createClient } from '@/lib/supabase/server'
import StoreClient from './StoreClient'

export default async function StorePage() {
  const supabase = await createClient()

  const [
    { data: albumStock },
    { data: stickerStock },
    { data: combos },
    { data: collectionTypes },
    { data: accesorioStock },
    { data: stockImagenes },
  ] = await Promise.all([
    supabase
      .from('stock_albums')
      .select('id, cantidad, precio_venta, estado, condicion, notas, imagen_url, albums(id, nombre, imagen_url, edicion, total_laminas, anio, type_id, collection_types(nombre, id))')
      .gt('cantidad', 0)
      .order('id'),
    supabase
      .from('stock_stickers')
      .select('id, cantidad, precio_venta, es_repetida, imagen_url, notas, stickers(id, numero, descripcion, albums(nombre, anio, collection_types(nombre)))')
      .gt('cantidad', 0)
      .order('id'),
    supabase
      .from('combos')
      .select('id, nombre, descripcion, precio_total, imagen_url')
      .eq('activo', true),
    supabase
      .from('collection_types')
      .select('*')
      .order('nombre'),
    supabase
      .from('stock_accesorios')
      .select('id, cantidad, precio_venta, tipo, cantidad_contenido, imagen_url, notas, albums(id, nombre, imagen_url, anio, collection_types(nombre))')
      .gt('cantidad', 0)
      .order('id'),
    supabase
      .from('stock_imagenes')
      .select('tabla, referencia_id, url, orden')
      .order('orden'),
  ])

  return (
    <StoreClient
      albumStock={albumStock ?? []}
      stickerStock={stickerStock ?? []}
      combos={combos ?? []}
      collectionTypes={collectionTypes ?? []}
      accesorioStock={accesorioStock ?? []}
      stockImagenes={stockImagenes ?? []}
    />
  )
}
