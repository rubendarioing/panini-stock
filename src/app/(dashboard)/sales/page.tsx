import { createClient } from '@/lib/supabase/server'
import SalesClient from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: albumStock }, { data: stickerStock }, { data: combos }, { data: accesorioStock }] = await Promise.all([
    supabase
      .from('sales')
      .select('*, sale_items(*), profiles(nombre), clientes(nombre, email, telefono, ciudad, direccion)')
      .order('fecha', { ascending: false })
      .limit(100),
    supabase
      .from('stock_albums')
      .select('id, cantidad, precio_venta, estado, albums(nombre, anio, collection_types(nombre))'),
    supabase
      .from('stock_stickers')
      .select('id, cantidad, precio_venta, stickers(numero, descripcion, albums(nombre))'),
    supabase.from('combos').select('id, nombre, precio_total').eq('activo', true),
    supabase
      .from('stock_accesorios')
      .select('id, tipo, cantidad_contenido, albums(nombre, anio)'),
  ])

  return (
    <SalesClient
      sales={sales ?? []}
      albumStock={albumStock ?? []}
      stickerStock={stickerStock ?? []}
      combos={combos ?? []}
      accesorioStock={accesorioStock ?? []}
    />
  )
}
