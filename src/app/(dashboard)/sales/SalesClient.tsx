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
import { Plus, Trash2, ShoppingCart } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CartItem {
  tipo: 'album' | 'sticker' | 'combo'
  referencia_id: number
  label: string
  cantidad: number
  precio_unitario: number
}

const metodoBadge: Record<string, string> = {
  efectivo: 'success', transferencia: 'default', otro: 'secondary'
}

export default function SalesClient({ sales, albumStock, stickerStock, combos }: {
  sales: any[]; albumStock: any[]; stickerStock: any[]; combos: any[]
}) {
  const [open, setOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [itemType, setItemType] = useState('album')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [cliente, setCliente] = useState('')
  const [contacto, setContacto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function getItemOptions() {
    if (itemType === 'album') return albumStock.map((s: any) => ({ value: String(s.id), label: `${s.albums?.collections?.nombre} ${s.albums?.collections?.anio} — ${s.albums?.nombre} (${s.cantidad} disp.)`, precio: s.precio_venta, max: s.cantidad }))
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
      setCart([...cart, {
        tipo: itemType as any,
        referencia_id: Number(itemRef),
        label: found.label,
        cantidad: Number(itemQty),
        precio_unitario: found.precio,
      }])
    }
    setItemRef('')
    setItemQty('1')
  }

  function removeFromCart(idx: number) {
    setCart(cart.filter((_, i) => i !== idx))
  }

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
      fecha: new Date().toISOString(),
      usuario_id: user!.id,
      notas: notas || null,
    }).select().single()

    if (error || !sale) { setLoading(false); return }

    const items = cart.map((i) => ({
      sale_id: sale.id,
      tipo: i.tipo,
      referencia_id: i.referencia_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.precio_unitario * i.cantidad,
    }))

    await supabase.from('sale_items').insert(items)

    for (const item of cart) {
      if (item.tipo === 'album') {
        const found = albumStock.find((s: any) => s.id === item.referencia_id)
        if (found) await supabase.from('stock_albums').update({ cantidad: found.cantidad - item.cantidad }).eq('id', item.referencia_id)
      } else if (item.tipo === 'sticker') {
        const found = stickerStock.find((s: any) => s.id === item.referencia_id)
        if (found) await supabase.from('stock_stickers').update({ cantidad: found.cantidad - item.cantidad }).eq('id', item.referencia_id)
      }
    }

    setCart([])
    setCliente('')
    setContacto('')
    setNotas('')
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 mt-1">Registro de ventas — descuenta stock automáticamente</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nueva venta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar venta</DialogTitle>
            </DialogHeader>
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay ventas registradas</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">{formatDate(sale.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{sale.cliente_nombre ?? 'Anónimo'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{sale.sale_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(sale.total)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={metodoBadge[sale.metodo_pago] as any}>{sale.metodo_pago}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{sale.profiles?.nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
