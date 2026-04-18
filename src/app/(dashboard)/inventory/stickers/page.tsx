import { createClient } from '@/lib/supabase/server'
import StickersStockClient from './StickersStockClient'

export default async function StickersStockPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: stickers }] = await Promise.all([
    supabase
      .from('stock_stickers')
      .select('*, stickers(numero, descripcion, albums(nombre, collections(nombre, anio)))')
      .order('fecha_compra', { ascending: false }),
    supabase
      .from('stickers')
      .select('*, albums(nombre, collections(nombre, anio))')
      .order('numero'),
  ])

  return <StickersStockClient stock={stock ?? []} stickers={stickers ?? []} />
}
