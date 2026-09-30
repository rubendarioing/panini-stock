'use client'

import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Package2, Pencil, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { labelForVariante } from '@/lib/product-labels'

interface ComboItemForm { variante_id: string; cantidad: number; label: string; precio: number; stock: number }

function toItemForm(v: any, cantidad: number): ComboItemForm {
  return {
    variante_id: String(v.id),
    cantidad,
    label: labelForVariante(v),
    precio: v.precio_venta ?? 0,
    stock: v.inventario?.cantidad ?? 0,
  }
}

const CATEGORIAS = [
  { value: 'album', label: 'Álbum' },
  { value: 'lamina', label: 'Lámina' },
  { value: 'sobre', label: 'Sobre' },
  { value: 'caja', label: 'Caja' },
  { value: 'set_actualizacion', label: 'Set de actualización' },
]

export default function CombosClient({ combos, variantes }: {
  combos: any[]; variantes: any[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio_total: '' })
  const [items, setItems] = useState<ComboItemForm[]>([])
  const [itemCategoria, setItemCategoria] = useState('album')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [cantidadCombos, setCantidadCombos] = useState('0')
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  async function uploadImage(comboId: number): Promise<string | null> {
    if (!imageFile) return null
    setUploading(true)
    const ext = imageFile.name.split('.').pop()
    const path = `combos/${comboId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('album-images').upload(path, imageFile, { upsert: true })
    setUploading(false)
    if (error) return null
    const { data } = supabase.storage.from('album-images').getPublicUrl(path)
    return data.publicUrl
  }

  function getOptions() {
    return variantes
      .filter((v: any) => v.productos?.categorias?.slug === itemCategoria)
      .map((v: any) => ({
        value: String(v.id),
        label: `${labelForVariante(v)} (${v.inventario?.cantidad ?? 0} disp.)`,
        variante: v,
      }))
  }

  function addItem() {
    if (!itemRef) return
    const found = getOptions().find((o) => o.value === itemRef)
    const qty = Math.max(1, Number(itemQty) || 1)
    if (!found) return
    const idx = items.findIndex((i) => i.variante_id === itemRef)
    if (idx >= 0) {
      setItems(items.map((i, n) => (n === idx ? { ...i, cantidad: i.cantidad + qty } : i)))
    } else {
      setItems([...items, toItemForm(found.variante, qty)])
    }
    setItemRef('')
    setItemQty('1')
  }

  // Máximo de combos que se pueden armar: stock libre de cada ítem más lo que
  // este mismo combo ya tiene apartado (se devuelve antes de volver a reservar).
  const maxCombos = useMemo(() => {
    if (items.length === 0) return 0
    const reservadoPorVariante = new Map<string, number>()
    for (const c of editing?.combo_componentes ?? []) {
      reservadoPorVariante.set(String(c.variante_id), c.cantidad * (editing?.stock ?? 0))
    }
    return Math.min(...items.map((i) =>
      Math.floor((i.stock + (reservadoPorVariante.get(i.variante_id) ?? 0)) / i.cantidad)
    ))
  }, [items, editing])

  function openCreate() {
    setEditing(null)
    setForm({ nombre: '', descripcion: '', precio_total: '' })
    setItems([])
    setCantidadCombos('0')
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(combo: any) {
    setEditing(combo)
    setForm({ nombre: combo.nombre, descripcion: combo.descripcion ?? '', precio_total: String(combo.precio_total) })
    setItems((combo.combo_componentes ?? []).map((c: any) =>
      toItemForm({ ...c.producto_variantes, id: c.variante_id }, c.cantidad)
    ))
    setCantidadCombos(String(combo.stock ?? 0))
    setImageFile(null)
    setImagePreview(combo.imagen_url ?? null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cantidad = Number(cantidadCombos) || 0
    if (cantidad > maxCombos) {
      alert(`Con el stock actual solo se pueden armar ${maxCombos} combo(s).`)
      return
    }
    setLoading(true)

    const datos = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio_total: Number(form.precio_total),
    }

    let comboId: number
    if (editing) {
      const { error } = await supabase.from('combos').update(datos).eq('id', editing.id)
      if (error) { alert(`Error al actualizar el combo: ${error.message}`); setLoading(false); return }
      comboId = editing.id
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: combo, error } = await supabase.from('combos')
        .insert({ ...datos, activo: true, creado_por: user!.id })
        .select().single()
      if (error || !combo) { alert(`Error al crear el combo: ${error?.message ?? ''}`); setLoading(false); return }
      comboId = combo.id
      // Si lo que sigue falla, reintentar debe actualizar este combo, no crear otro.
      setEditing({ ...combo, combo_componentes: [], stock: 0 })
    }

    if (imageFile) {
      const url = await uploadImage(comboId)
      if (url) await supabase.from('combos').update({ imagen_url: url }).eq('id', comboId)
    }

    // Componentes + cantidad en una sola transacción: devuelve lo apartado antes
    // y aparta los ítems para la nueva cantidad (031_combos_stock_reservado.sql).
    const { error: rpcError } = await supabase.rpc('guardar_combo', {
      p_combo_id: comboId,
      p_componentes: items.map((i) => ({ variante_id: Number(i.variante_id), cantidad: i.cantidad })),
      p_cantidad: cantidad,
    })
    setLoading(false)
    if (rpcError) {
      alert(`El combo se guardó, pero no se pudieron guardar sus ítems/cantidad: ${rpcError.message}`)
      router.refresh()
      return
    }

    setOpen(false)
    router.refresh()
  }

  async function handleDelete(combo: any) {
    const aviso = combo.stock > 0
      ? ` Sus ${combo.stock} combo(s) armados se desarman y los ítems vuelven al inventario.`
      : ''
    if (!confirm(`¿Eliminar el combo "${combo.nombre}"?${aviso}`)) return
    // Si tiene ventas, el trigger de 034_combos_delete.sql lo rechaza con un
    // mensaje explicando que se debe desactivar.
    const { error } = await supabase.from('combos').delete().eq('id', combo.id)
    if (error) alert(error.message)
    router.refresh()
  }

  async function toggleActive(combo: any) {
    if (combo.activo && combo.stock > 0 &&
        !confirm(`Al desactivar "${combo.nombre}" sus ${combo.stock} combo(s) armados se desarman y los ítems vuelven al inventario. ¿Continuar?`)) {
      return
    }
    const { error } = await supabase.from('combos').update({ activo: !combo.activo }).eq('id', combo.id)
    if (error) alert(`No se pudo actualizar el combo: ${error.message}`)
    router.refresh()
  }

  const suggestedPrice = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combos</h1>
          <p className="text-gray-500 mt-1">Paquetes de álbumes, láminas y accesorios con precio especial</p>
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

              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium text-gray-700">Agregar ítems al combo</p>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={itemCategoria} onValueChange={(v) => { setItemCategoria(v); setItemRef('') }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
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
                        <span className={item.stock > 0 ? 'text-gray-700' : 'text-orange-600'}>
                          {item.cantidad}x {item.label}
                          <span className="text-xs text-gray-400"> · {item.stock} disp.</span>
                        </span>
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

              <div className="space-y-1.5">
                <Label>Imagen del combo (opcional)</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {imagePreview ? (
                    <div className="relative w-full h-32">
                      <Image src={imagePreview} alt="Preview" fill className="object-contain rounded" unoptimized />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-sm">Click para subir imagen</span>
                      <span className="text-xs">PNG, JPG hasta 5MB</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImageFile(file)
                    setImagePreview(URL.createObjectURL(file))
                  }}
                />
                {imageFile && <p className="text-xs text-green-600">Imagen lista: {imageFile.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Cantidad de combos armados</Label>
                <Input
                  type="number" min="0" max={maxCombos}
                  value={cantidadCombos}
                  onChange={(e) => setCantidadCombos(e.target.value)}
                  disabled={editing && !editing.activo}
                />
                {editing && !editing.activo ? (
                  <p className="text-xs text-gray-400">Activa el combo para asignarle cantidad.</p>
                ) : (
                  <p className={`text-xs ${Number(cantidadCombos) > maxCombos ? 'text-red-500' : 'text-gray-400'}`}>
                    Máximo con el stock actual: {maxCombos}. Los ítems se apartan del inventario y dejan de venderse sueltos.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Precio del combo ($)</Label>
                <Input type="number" min="0" value={form.precio_total} onChange={(e) => setForm({ ...form, precio_total: e.target.value })} placeholder={String(suggestedPrice || '')} required />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading || uploading || Number(cantidadCombos) > maxCombos} className="flex-1">{uploading ? 'Subiendo imagen...' : loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear combo'}</Button>
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
          <div key={combo.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${combo.activo ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            {combo.imagen_url && (
              <div className="relative w-full h-36 bg-gray-100">
                <Image src={combo.imagen_url} alt={combo.nombre} fill className="object-cover" unoptimized />
              </div>
            )}
            <div className="p-5">
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
            <p className="text-sm font-medium text-gray-700 mb-1">{combo.stock} combo(s) disponibles</p>
            <ul className="text-xs text-gray-400 mb-4 space-y-0.5">
              {(combo.combo_componentes ?? []).map((c: any) => (
                <li key={c.variante_id}>{c.cantidad}x {labelForVariante(c.producto_variantes)}</li>
              ))}
              {!combo.combo_componentes?.length && <li>Sin ítems</li>}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(combo)} className="flex-1">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant={combo.activo ? 'destructive' : 'success'} onClick={() => toggleActive(combo)} className="flex-1">
                {combo.activo ? 'Desactivar' : 'Activar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(combo)} title="Eliminar combo" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
