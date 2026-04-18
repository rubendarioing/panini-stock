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
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

const condicionColors: Record<string, string> = {
  nuevo: 'success',
  sellado: 'default',
  usado: 'warning',
}

export default function AlbumsStockClient({ stock, albums }: { stock: any[]; albums: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    album_id: '', cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    condicion: 'nuevo', notas: '',
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({ album_id: '', cantidad: '1', precio_compra: '', precio_venta: '', fecha_compra: new Date().toISOString().split('T')[0], condicion: 'nuevo', notas: '' })
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      album_id: String(item.album_id), cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra), precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra, condicion: item.condicion, notas: item.notas ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      album_id: Number(form.album_id), cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra), precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra, condicion: form.condicion,
      notas: form.notas || null, usuario_id: user!.id,
    }
    if (editing) {
      await supabase.from('stock_albums').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('stock_albums').insert(payload)
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro de stock?')) return
    await supabase.from('stock_albums').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock de Álbumes</h1>
            <p className="text-gray-500 mt-0.5">{stock.filter(s => s.cantidad > 0).length} registros con stock</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Agregar stock</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar registro' : 'Nuevo stock de álbum'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Álbum</Label>
                <Select value={form.album_id} onValueChange={(v) => setForm({ ...form, album_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar álbum..." /></SelectTrigger>
                  <SelectContent>
                    {albums.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.collections?.nombre} {a.collections?.anio} — {a.nombre}
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
                  <Label>Condición</Label>
                  <Select value={form.condicion} onValueChange={(v) => setForm({ ...form, condicion: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="sellado">Sellado</SelectItem>
                      <SelectItem value="usado">Usado</SelectItem>
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Álbum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Condición</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Compra</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Venta</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Margen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha compra</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stock.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay stock registrado</td></tr>
              ) : stock.map((item) => {
                const margen = item.precio_venta - item.precio_compra
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.albums?.nombre}</p>
                      <p className="text-xs text-gray-400">{item.albums?.collections?.nombre} {item.albums?.collections?.anio}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={condicionColors[item.condicion] as any}>{item.condicion}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.cantidad}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.precio_compra)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(item.precio_venta)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${margen >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(margen)}
                    </td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
