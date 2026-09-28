import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: variantes } = await supabase
    .from('producto_variantes')
    .select('precio_venta, inventario ( cantidad ), productos ( categorias ( slug ) )')

  const albumRows  = (variantes ?? []).filter((v: any) => v.productos?.categorias?.slug === 'album' && (v.inventario?.cantidad ?? 0) > 0)
  const laminaRows = (variantes ?? []).filter((v: any) => v.productos?.categorias?.slug === 'lamina' && (v.inventario?.cantidad ?? 0) > 0)

  const albumCount = albumRows.length
  const stickerCount = laminaRows.length
  const albumValue = albumRows.reduce((acc, i: any) => acc + i.precio_venta * (i.inventario?.cantidad ?? 0), 0)
  const stickerValue = laminaRows.reduce((acc, i: any) => acc + i.precio_venta * (i.inventario?.cantidad ?? 0), 0)

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
              <p className="text-gray-500 text-sm">{albumCount} registros activos</p>
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
              <p className="text-gray-500 text-sm">{stickerCount} registros activos</p>
              <p className="text-green-600 font-semibold mt-1">{formatCurrency(stickerValue)}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
