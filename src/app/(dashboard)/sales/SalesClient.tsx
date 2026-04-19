'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Eye, ChevronDown } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Image from 'next/image'

interface CartItem {
  tipo: 'album' | 'sticker' | 'combo'
  referencia_id: number
  label: string
  cantidad: number
  precio_unitario: number
}

const estadoConfig: Record<string, { label: string; variant: string; next: string | null; nextLabel: string | null }> = {
  pendiente:   { label: 'Pendiente',   variant: 'warning',     next: 'confirmado', nextLabel: 'Confirmar' },
  confirmado:  { label: 'Confirmado',  variant: 'default',     next: 'enviado',    nextLabel: 'Marcar enviado' },
  enviado:     { label: 'Enviado',     variant: 'success',     next: 'entregado',  nextLabel: 'Marcar entregado' },
  entregado:   { label: 'Entregado',   variant: 'success',     next: null,         nextLabel: null },
  cancelado:   { label: 'Cancelado',   variant: 'destructive', next: null,         nextLabel: null },
}

const metodoBadge: Record<string, string> = {
  efectivo: 'success', transferencia: 'default', otro: 'secondary',
}

export default function SalesClient({ sales, albumStock, stickerStock, combos }: {
  sales: any[]; albumStock: any[]; stickerStock: any[]; combos: any[]
}) {
  const [open, setOpen] = useState(false)
  const [detailSale, setDetailSale] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [itemType, setItemType] = useState('album')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [cliente, setCliente] = useState('')
  const [contacto, setContacto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [filterEstado, setFilterEstado] = useState('all')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function getItemOptions() {
    if (itemType === 'album') return albumStock.map((s: any) => ({ value: String(s.id), label: `${s.albums?.collection_types?.nombre} ${s.albums?.anio} — ${s.albums?.nombre} (${s.cantidad} disp.)`, precio: s.precio_venta, max: s.cantidad }))
    if (itemType === 'sticker') return stickerStock.map((s: any) => ({ value: String(s.id), label: `#${s.stickers?.numero} — ${s.stickers?.albums?.nombre} (${s.cantidad} disp.)`, precio: s.precio_venta, max: s.cantidad }))
    return combos.map((c: any) => ({ value: String(c.id), label: c.nombre, precio: c.precio_total, max: 999 }))
  }

  function addToCart() {
    if (!itemRef) return
    const options = getItemOptions()
    const found = options.find((o) => o.value === itemRef)
    if (!found) return
    const existing = cart.findIndex((c) => c.tipo === itemType && c.referencia_id === Number(itemRef))
    if (existing >= 0) {
      const updated = [...cart]
      updated[existing].cantidad += Number(itemQty)
      setCart(updated)
    } else {
      setCart([...cart, { tipo: itemType as any, referencia_id: Number(itemRef), label: found.label, cantidad: Number(itemQty), precio_unitario: found.precio }])
    }
    setItemRef('')
    setItemQty('1')
  }

  function removeFromCart(idx: number) { setCart(cart.filter((_, i) => i !== idx)) }

  const total = cart.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)

  async function handleSale(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: sale, error } = await supabase.from('sales').insert({
      cliente_nombre: cliente || null,
      cliente_contacto: contacto || null,
      total,
      metodo_pago: metodoPago,
      estado: 'confirmado',
      fecha: new Date().toISOString(),
      usuario_id: user!.id,
      notas: notas || null,
    }).select().single()

    if (error || !sale) { setLoading(false); return }

    await supabase.from('sale_items').insert(cart.map((i) => ({
      sale_id: sale.id, tipo: i.tipo, referencia_id: i.referencia_id,
      cantidad: i.cantidad, precio_unitario: i.precio_unitario, subtotal: i.precio_unitario * i.cantidad,
    })))

    for (const item of cart) {
      if (item.tipo === 'album') {
        const found = albumStock.find((s: any) => s.id === item.referencia_id)
        if (found) await supabase.from('stock_albums').update({ cantidad: found.cantidad - item.cantidad }).eq('id', item.referencia_id)
      } else if (item.tipo === 'sticker') {
        const found = stickerStock.find((s: any) => s.id === item.referencia_id)
        if (found) await supabase.from('stock_stickers').update({ cantidad: found.cantidad - item.cantidad }).eq('id', item.referencia_id)
      }
    }

    setCart([]); setCliente(''); setContacto(''); setNotas('')
    setLoading(false); setOpen(false); router.refresh()
  }

  async function avanzarEstado(sale: any) {
    const config = estadoConfig[sale.estado]
    if (!config?.next) return
    await supabase.from('sales').update({ estado: config.next }).eq('id', sale.id)
    router.refresh()
  }

  async function cancelarVenta(sale: any) {
    if (!confirm('¿Cancelar esta venta?')) return
    await supabase.from('sales').update({ estado: 'cancelado' }).eq('id', sale.id)
    router.refresh()
  }

  function getItemLabel(item: any): string {
    if (item.tipo === 'album') {
      const s = albumStock.find((a: any) => a.id === item.referencia_id)
      if (!s) return 'Álbum'
      const estadoLabel = s.estado === 'lleno' ? 'Lleno' : s.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío'
      return `${s.albums?.nombre} ${s.albums?.anio} — ${estadoLabel}`
    }
    if (item.tipo === 'sticker') {
      const s = stickerStock.find((a: any) => a.id === item.referencia_id)
      const st = s?.stickers
      return st ? `${st.descripcion ?? `#${st.numero}`} — ${st.albums?.nombre}` : 'Lámina'
    }
    if (item.tipo === 'combo') {
      const c = combos.find((a: any) => a.id === item.referencia_id)
      return c?.nombre ?? 'Combo'
    }
    return item.tipo
  }

  const filtered = sales.filter((s) => filterEstado === 'all' || s.estado === filterEstado)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 mt-1">Registro y seguimiento de pedidos</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(estadoConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nueva venta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar venta</DialogTitle></DialogHeader>
              <form onSubmit={handleSale} className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cliente (opcional)</Label>
                    <Input placeholder="Nombre del cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contacto (opcional)</Label>
                    <Input placeholder="Teléfono / correo" value={contacto} onChange={(e) => setContacto(e.target.value)} />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Agregar producto</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Select value={itemType} onValueChange={setItemType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="album">Álbum</SelectItem>
                        <SelectItem value="sticker">Lámina</SelectItem>
                        <SelectItem value="combo">Combo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={itemRef} onValueChange={setItemRef}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {getItemOptions().map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-20" />
                      <Button type="button" onClick={addToCart} size="sm" variant="outline">Agregar</Button>
                    </div>
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Producto</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Cant.</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">P. Unit.</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Subtotal</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cart.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-gray-700 max-w-[200px] truncate">{item.label}</td>
                            <td className="px-4 py-2 text-right">{item.cantidad}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(item.precio_unitario)}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.precio_unitario * item.cantidad)}</td>
                            <td className="px-4 py-2">
                              <button type="button" onClick={() => removeFromCart(idx)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 font-semibold text-right text-gray-900">Total:</td>
                          <td className="px-4 py-2 font-bold text-right text-green-600 text-base">{formatCurrency(total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Método de pago</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notas (opcional)</Label>
                  <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading || cart.length === 0} variant="success" className="flex-1">
                    {loading ? 'Registrando...' : `Confirmar venta — ${formatCurrency(total)}`}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ciudad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Productos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No hay ventas registradas</td></tr>
              ) : filtered.map((sale) => {
                const config = estadoConfig[sale.estado] ?? estadoConfig.pendiente
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(sale.fecha)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{sale.clientes?.nombre ?? sale.cliente_nombre ?? 'Anónimo'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{sale.clientes?.telefono ?? sale.cliente_contacto ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{sale.clientes?.ciudad ?? sale.ciudad ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px]">
                      {sale.sale_items?.slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="truncate">
                          <span className="font-medium">{item.cantidad}×</span> {getItemLabel(item)}
                        </div>
                      ))}
                      {sale.sale_items?.length > 2 && (
                        <div className="text-gray-400">+{sale.sale_items.length - 2} más</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(sale.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={config.variant as any}>{config.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={metodoBadge[sale.metodo_pago] as any}>{sale.metodo_pago}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end items-center">
                        {config.next && (
                          <button
                            onClick={() => avanzarEstado(sale)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors whitespace-nowrap"
                          >
                            <ChevronDown className="h-3 w-3" /> {config.nextLabel}
                          </button>
                        )}
                        <button
                          onClick={() => setDetailSale(sale)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {sale.estado !== 'cancelado' && sale.estado !== 'entregado' && (
                          <button
                            onClick={() => cancelarVenta(sale)}
                            className="px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle de venta */}
      {detailSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailSale(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Pedido #{detailSale.id}</h2>
                <p className="text-sm text-gray-500">{formatDate(detailSale.fecha)}</p>
              </div>
              <Badge variant={(estadoConfig[detailSale.estado]?.variant ?? 'secondary') as any}>
                {estadoConfig[detailSale.estado]?.label ?? detailSale.estado}
              </Badge>
            </div>

            <div className="p-6 space-y-5">
              {/* Datos del cliente */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Datos del cliente</p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                  <p><span className="text-gray-500">Nombre:</span> <span className="font-medium">{detailSale.clientes?.nombre ?? detailSale.cliente_nombre ?? '—'}</span></p>
                  <p><span className="text-gray-500">WhatsApp:</span> <span className="font-medium">{detailSale.clientes?.telefono ?? detailSale.cliente_contacto ?? '—'}</span></p>
                  {(detailSale.clientes?.email ?? detailSale.email_cliente) && (
                    <p><span className="text-gray-500">Email:</span> <span className="font-medium">{detailSale.clientes?.email ?? detailSale.email_cliente}</span></p>
                  )}
                  {(detailSale.clientes?.ciudad ?? detailSale.ciudad) && (
                    <p><span className="text-gray-500">Ciudad:</span> <span className="font-medium">{detailSale.clientes?.ciudad ?? detailSale.ciudad}</span></p>
                  )}
                  {(detailSale.clientes?.direccion ?? detailSale.direccion_envio) && (
                    <p><span className="text-gray-500">Dirección:</span> <span className="font-medium">{detailSale.clientes?.direccion ?? detailSale.direccion_envio}</span></p>
                  )}
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Productos</p>
                <div className="space-y-1.5">
                  {detailSale.sale_items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{getItemLabel(item)}</p>
                        <p className="text-xs text-gray-400 capitalize">{item.tipo} · {item.cantidad} und. × {formatCurrency(item.precio_unitario)}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>Total</span>
                    <span className="text-green-600">{formatCurrency(detailSale.total)}</span>
                  </div>
                </div>
              </div>

              {/* Comprobante */}
              {detailSale.comprobante_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Comprobante de pago</p>
                  <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 240 }}>
                    <Image src={detailSale.comprobante_url} alt="Comprobante" fill className="object-contain" unoptimized />
                  </div>
                  <a href={detailSale.comprobante_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                    Ver imagen completa
                  </a>
                </div>
              )}

              {/* Notas */}
              {detailSale.notas && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notas</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{detailSale.notas}</p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                {estadoConfig[detailSale.estado]?.next && (
                  <Button
                    variant="success"
                    className="flex-1"
                    onClick={() => { avanzarEstado(detailSale); setDetailSale(null) }}
                  >
                    {estadoConfig[detailSale.estado].nextLabel}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailSale(null)} className="flex-1">Cerrar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
