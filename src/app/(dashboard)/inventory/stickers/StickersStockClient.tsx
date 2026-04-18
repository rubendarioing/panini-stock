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
import { Plus, Pencil, Trash2, ArrowLeft, Filter } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function StickersStockClient({ stock, stickers }: { stock: any[]; stickers: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterRepetida, setFilterRepetida] = useState<string>('all')
  const [form, setForm] = useState({
    sticker_id: '', cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    es_repetida: 'false', notas: '',
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({ sticker_id: '', cantidad: '1', precio_compra: '', precio_venta: '', fecha_compra: new Date().toISOString().split('T')[0], es_repetida: 'false', notas: '' })
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      sticker_id: String(item.sticker_id), cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra), precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra, es_repetida: String(item.es_repetida), notas: item.notas ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      sticker_id: Number(form.sticker_id), cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra), precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra, es_repetida: form.es_repetida === 'true',
      notas: form.notas || null, usuario_id: user!.id,
    }
    if (editing) {
      await supabase.from('stock_stickers').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('stock_stickers').insert(payload)
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('stock_stickers').delete().eq('id', id)
    router.refresh()
  }

  const filtered = stock.filter((s) => {
    if (filterRepetida === 'repetida') return s.es_repetida
    if (filterRepetida === 'normal') return !s.es_repetida
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock de Láminas</h1>
            <p className="text-gray-500 mt-0.5">{filtered.length} registros</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterRepetida}
              onChange={(e) => setFilterRepetida(e.target.value)}
              className="outline-none text-gray-700 bg-transparent"
            >
              <option value="all">Todas</option>
              <option value="normal">Normales</option>
              <option value="repetida">Repetidas</option>
            </select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Agregar lámina</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar lámina' : 'Nueva lámina en stock'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Lámina</Label>
                  <Select value={form.sticker_id} onValueChange={(v) => setForm({ ...form, sticker_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Buscar lámina..." /></SelectTrigger>
                    <SelectContent>
                      {stickers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          #{s.numero} — {s.albums?.nombre} ({s.albums?.collections?.anio})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cantidad</Label>
                    <Input type="number" min="0" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>¿Es repetida?</Label>
                    <Select value={form.es_repetida} onValueChange={(v) => setForm({ ...form, es_repetida: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No</SelectItem>
                        <SelectItem value="true">Sí (repetida)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Precio compra ($)</Label>
                    <Input type="number" min="0" value={form.precio_compra} onChange={(e) => setForm({ ...form, precio_compra: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Precio venta ($)</Label>
                    <Input type="number" min="0" value={form.precio_venta} onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de compra</Label>
                  <Input type="date" value={form.fecha_compra} onChange={(e) => setForm({ ...form, fecha_compra: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Notas (opcional)</Label>
                  <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}</Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Lámina</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Álbum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Compra</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Venta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha compra</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay láminas registradas</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">#{item.stickers?.numero}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{item.stickers?.albums?.nombre}</p>
                    <p className="text-xs text-gray-400">{item.stickers?.albums?.collections?.nombre} {item.stickers?.albums?.collections?.anio}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={item.es_repetida ? 'warning' : 'secondary'}>
                      {item.es_repetida ? 'Repetida' : 'Normal'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{item.cantidad}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.precio_compra)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(item.precio_venta)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(item.fecha_compra)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
