import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [
    { data: albumStock, count: albumCount },
    { data: stickerStock, count: stickerCount },
  ] = await Promise.all([
    supabase
      .from('stock_albums')
      .select('precio_venta, cantidad, albums(nombre, collection_types(nombre))', { count: 'exact' })
      .gt('cantidad', 0)
      .order('fecha_compra', { ascending: false })
      .limit(5),
    supabase
      .from('stock_stickers')
      .select('precio_venta, cantidad, stickers(numero, albums(nombre))', { count: 'exact' })
      .gt('cantidad', 0)
      .order('fecha_compra', { ascending: false })
      .limit(5),
  ])

  const albumValue = albumStock?.reduce((acc, i) => acc + i.precio_venta * i.cantidad, 0) ?? 0
  const stickerValue = stickerStock?.reduce((acc, i) => acc + i.precio_venta * i.cantidad, 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-500 mt-1">Gestión de stock de álbumes y láminas</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Link href="/inventory/albums" className="group bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 rounded-lg p-3 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Álbumes y Set a pegar</h2>
              <p className="text-gray-500 text-sm">{albumCount ?? 0} registros activos</p>
              <p className="text-blue-600 font-semibold mt-1">{formatCurrency(albumValue)}</p>
            </div>
          </div>
        </Link>

        <Link href="/inventory/stickers" className="group bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:border-green-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 rounded-lg p-3 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
              <Layers className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Láminas sueltas</h2>
              <p className="text-gray-500 text-sm">{stickerCount ?? 0} registros activos</p>
              <p className="text-green-600 font-semibold mt-1">{formatCurrency(stickerValue)}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
