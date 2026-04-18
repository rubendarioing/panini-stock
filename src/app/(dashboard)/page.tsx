import { createClient } from '@/lib/supabase/server'
import { Package, BookOpen, ShoppingCart, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalAlbums },
    { count: totalStickers },
    { data: recentSales },
    { data: lowStock },
  ] = await Promise.all([
    supabase.from('stock_albums').select('*', { count: 'exact', head: true }).gt('cantidad', 0),
    supabase.from('stock_stickers').select('*', { count: 'exact', head: true }).gt('cantidad', 0),
    supabase
      .from('sales')
      .select('id, cliente_nombre, total, fecha, metodo_pago')
      .order('fecha', { ascending: false })
      .limit(5),
    supabase
      .from('stock_albums')
      .select('id, cantidad, albums(nombre, collection_types(nombre))')
      .lt('cantidad', 3)
      .gt('cantidad', 0)
      .limit(5),
  ])

  const { data: salesTotal } = await supabase
    .from('sales')
    .select('total')
    .gte('fecha', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  const monthlySales = salesTotal?.reduce((acc, s) => acc + s.total, 0) ?? 0

  const stats = [
    { label: 'Álbumes en stock', value: totalAlbums ?? 0, icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Láminas en stock', value: totalStickers ?? 0, icon: Package, color: 'bg-green-500' },
    { label: 'Ventas este mes', value: formatCurrency(monthlySales), icon: ShoppingCart, color: 'bg-purple-500' },
    { label: 'Registros activos', value: (totalAlbums ?? 0) + (totalStickers ?? 0), icon: TrendingUp, color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen general del inventario</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className={`${color} rounded-lg p-3 text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas recientes</h2>
          {recentSales && recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sale.cliente_nombre ?? 'Cliente anónimo'}</p>
                    <p className="text-xs text-gray-400">{new Date(sale.fecha).toLocaleDateString('es-CO')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(sale.total)}</p>
                    <p className="text-xs text-gray-400 capitalize">{sale.metodo_pago}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No hay ventas registradas aún</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock bajo (álbumes)</h2>
          {lowStock && lowStock.length > 0 ? (
            <div className="space-y-3">
              {lowStock.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.albums?.nombre}</p>
                    <p className="text-xs text-gray-400">{item.albums?.collection_types?.nombre}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {item.cantidad} restantes
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No hay alertas de stock bajo</p>
          )}
        </div>
      </div>
    </div>
  )
}
