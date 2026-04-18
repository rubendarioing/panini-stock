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
import { Plus, Trash2, Package2, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ComboItemForm { tipo: string; ref: string; cantidad: number; label: string; precio: number }

export default function CombosClient({ combos, albumStock, stickerStock }: { combos: any[]; albumStock: any[]; stickerStock: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio_total: '' })
  const [items, setItems] = useState<ComboItemForm[]>([])
  const [itemType, setItemType] = useState('album')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function getOptions() {
    if (itemType === 'album') return albumStock.map((s: any) => ({ value: String(s.id), label: `${s.albums?.collections?.nombre} ${s.albums?.collections?.anio} — ${s.albums?.nombre}`, precio: s.precio_venta }))
    return stickerStock.map((s: any) => ({ value: String(s.id), label: `#${s.stickers?.numero} — ${s.stickers?.albums?.nombre}`, precio: s.precio_venta }))
  }

  function addItem() {
    if (!itemRef) return
    const found = getOptions().find((o) => o.value === itemRef)
    if (!found) return
    setItems([...items, { tipo: itemType, ref: itemRef, cantidad: Number(itemQty), label: found.label, precio: found.precio }])
    setItemRef('')
    setItemQty('1')
  }

  function openCreate() {
    setEditing(null)
    setForm({ nombre: '', descripcion: '', precio_total: '' })
    setItems([])
    setOpen(true)
  }

  function openEdit(combo: any) {
    setEditing(combo)
    setForm({ nombre: combo.nombre, descripcion: combo.descripcion ?? '', precio_total: String(combo.precio_total) })
    setItems([])
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (editing) {
      await supabase.from('combos').update({ nombre: form.nombre, descripcion: form.descripcion || null, precio_total: Number(form.precio_total) }).eq('id', editing.id)
    } else {
      const { data: combo } = await supabase.from('combos').insert({
        nombre: form.nombre, descripcion: form.descripcion || null,
        precio_total: Number(form.precio_total), activo: true, creado_por: user!.id,
      }).select().single()

      if (combo && items.length > 0) {
        const comboItems = items.map((i) => ({
          combo_id: combo.id, tipo: i.tipo,
          stock_album_id: i.tipo === 'album' ? Number(i.ref) : null,
          stock_sticker_id: i.tipo === 'sticker' ? Number(i.ref) : null,
          cantidad: i.cantidad,
        }))
        await supabase.from('combo_items').insert(comboItems)
      }
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function toggleActive(combo: any) {
    await supabase.from('combos').update({ activo: !combo.activo }).eq('id', combo.id)
    router.refresh()
  }

  const suggestedPrice = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combos</h1>
          <p className="text-gray-500 mt-1">Paquetes de álbumes y láminas con precio especial</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nuevo combo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar combo' : 'Nuevo combo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Nombre del combo</Label>
                <Input placeholder="Ej: Pack Mundial 2022 completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} />
              </div>

              {!editing && (
                <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Agregar ítems al combo</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={itemType} onValueChange={setItemType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="album">Álbum</SelectItem>
                        <SelectItem value="sticker">Lámina</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={itemRef} onValueChange={setItemRef}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {getOptions().map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-16" />
                      <Button type="button" onClick={addItem} size="sm" variant="outline">+</Button>
                    </div>
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                          <span className="text-gray-700">{item.cantidad}x {item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{formatCurrency(item.precio * item.cantidad)}</span>
                            <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400 text-right">Precio sugerido: {formatCurrency(suggestedPrice)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Precio del combo ($)</Label>
                <Input type="number" min="0" value={form.precio_total} onChange={(e) => setForm({ ...form, precio_total: e.target.value })} placeholder={String(suggestedPrice || '')} required />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear combo'}</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos.length === 0 ? (
          <p className="text-gray-400 col-span-full text-center py-8">No hay combos creados</p>
        ) : combos.map((combo) => (
          <div key={combo.id} className={`bg-white rounded-xl border shadow-sm p-5 ${combo.activo ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Package2 className="h-4 w-4 text-purple-500" />
                  <Badge variant={combo.activo ? 'default' : 'secondary'}>{combo.activo ? 'Activo' : 'Inactivo'}</Badge>
                </div>
                <h3 className="font-semibold text-gray-900">{combo.nombre}</h3>
                {combo.descripcion && <p className="text-sm text-gray-500 mt-0.5">{combo.descripcion}</p>}
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600 mb-3">{formatCurrency(combo.precio_total)}</p>
            <p className="text-xs text-gray-400 mb-4">{combo.combo_items?.length ?? 0} ítems en el combo</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(combo)} className="flex-1">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant={combo.activo ? 'destructive' : 'success'} onClick={() => toggleActive(combo)} className="flex-1">
                {combo.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
