'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, ArrowLeft, Filter, SlidersHorizontal, ImageIcon, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import StockAdjustModal from '@/components/ui/stock-adjust-modal'

interface ExistingImage { id: number; url: string; orden: number }
interface PendingImage  { file: File; preview: string }

export default function StickersStockClient({ stock, stickers }: { stock: any[]; stickers: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterRepetida, setFilterRepetida] = useState<string>('all')
  const [selectedAlbum, setSelectedAlbum] = useState<string>('')
  const [form, setForm] = useState({
    sticker_id: '', cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    es_repetida: 'false', notas: '',
  })
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([])
  const [pendingImages, setPendingImages]   = useState<PendingImage[]>([])
  const [removedIds, setRemovedIds]         = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const albums = Array.from(
    new Map(stickers.map((s) => [s.album_id, s.albums])).entries()
  ).map(([id, album]) => ({ id, ...album }))

  const stickersFiltrados = selectedAlbum
    ? stickers
        .filter((s) => String(s.album_id) === selectedAlbum)
        .sort((a, b) => {
          const da = a.descripcion ?? String(a.numero)
          const db = b.descripcion ?? String(b.numero)
          return da.localeCompare(db, 'es', { numeric: true })
        })
    : []

  function resetImages() {
    setExistingImages([])
    setPendingImages([])
    setRemovedIds([])
  }

  function openCreate() {
    setEditing(null)
    setSelectedAlbum('')
    resetImages()
    setForm({ sticker_id: '', cantidad: '1', precio_compra: '', precio_venta: '', fecha_compra: new Date().toISOString().split('T')[0], es_repetida: 'false', notas: '' })
    setOpen(true)
  }

  async function openEdit(item: any) {
    setEditing(item)
    setSelectedAlbum(String(item.stickers?.album_id ?? ''))
    resetImages()
    setForm({
      sticker_id: String(item.sticker_id), cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra), precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra, es_repetida: String(item.es_repetida), notas: item.notas ?? '',
    })
    setOpen(true)
    const { data: imgs } = await supabase
      .from('stock_imagenes')
      .select('id, url, orden')
      .eq('tabla', 'stock_stickers')
      .eq('referencia_id', item.id)
      .order('orden')
    setExistingImages(imgs ?? [])
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    const news: PendingImage[] = Array.from(files).map(file => ({ file, preview: URL.createObjectURL(file) }))
    setPendingImages(prev => [...prev, ...news])
  }

  function removePending(idx: number) {
    setPendingImages(prev => prev.filter((_, i) => i !== idx))
  }

  function removeExisting(id: number) {
    setRemovedIds(prev => [...prev, id])
    setExistingImages(prev => prev.filter(img => img.id !== id))
  }

  async function saveImages(stockId: number) {
    if (removedIds.length > 0) {
      await supabase.from('stock_imagenes').delete().in('id', removedIds)
    }
    if (pendingImages.length > 0) {
      const { data: last } = await supabase
        .from('stock_imagenes').select('orden')
        .eq('tabla', 'stock_stickers').eq('referencia_id', stockId)
        .order('orden', { ascending: false }).limit(1)
      let nextOrden = last?.[0] ? last[0].orden + 1 : 0
      for (const { file } of pendingImages) {
        const ext = file.name.split('.').pop()
        const path = `stickers/${stockId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('sticker-images').upload(path, file, { upsert: true })
        if (!error) {
          const { data } = supabase.storage.from('sticker-images').getPublicUrl(path)
          await supabase.from('stock_imagenes').insert({ tabla: 'stock_stickers', referencia_id: stockId, url: data.publicUrl, orden: nextOrden++ })
        }
      }
    }
    const { data: first } = await supabase
      .from('stock_imagenes').select('url')
      .eq('tabla', 'stock_stickers').eq('referencia_id', stockId)
      .order('orden').limit(1).maybeSingle()
    await supabase.from('stock_stickers').update({ imagen_url: first?.url ?? null }).eq('id', stockId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload: any = {
      sticker_id: Number(form.sticker_id), cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra), precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra, es_repetida: form.es_repetida === 'true',
      notas: form.notas || null, usuario_id: user!.id,
    }
    if (editing) {
      await supabase.from('stock_stickers').update(payload).eq('id', editing.id)
      await saveImages(editing.id)
    } else {
      const { data: inserted } = await supabase.from('stock_stickers').insert(payload).select('id').single()
      if (inserted) await saveImages(inserted.id)
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    const item = stock.find((s: any) => s.id === id)
    if (item && item.cantidad > 0) {
      alert(`No se puede eliminar: tiene ${item.cantidad} unidad(es) en stock. Ajusta el stock a 0 primero.`)
      return
    }
    const { count: ventasCount } = await supabase
      .from('sale_items').select('id', { count: 'exact', head: true })
      .eq('tipo', 'sticker').eq('referencia_id', id)
    if (ventasCount && ventasCount > 0) {
      alert('No se puede eliminar: esta entrada tiene historial de ventas registradas.')
      return
    }
    const { count: comboCount } = await supabase
      .from('combo_items').select('id', { count: 'exact', head: true })
      .eq('stock_sticker_id', id)
    if (comboCount && comboCount > 0) {
      alert('No se puede eliminar: esta lámina está incluida en un combo.')
      return
    }
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('stock_imagenes').delete().eq('tabla', 'stock_stickers').eq('referencia_id', id)
    await supabase.from('stock_stickers').delete().eq('id', id)
    router.refresh()
  }

  const filtered = stock.filter((s) => {
    if (filterRepetida === 'repetida') return s.es_repetida
    if (filterRepetida === 'normal') return !s.es_repetida
    return true
  })

  const totalImages = existingImages.length + pendingImages.length

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
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar lámina' : 'Nueva lámina en stock'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Álbum</Label>
                  <Select
                    value={selectedAlbum}
                    onValueChange={(v) => { setSelectedAlbum(v); setForm((f) => ({ ...f, sticker_id: '' })) }}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar álbum..." /></SelectTrigger>
                    <SelectContent>
                      {albums.map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.collection_types?.nombre} — {a.nombre} ({a.anio})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lámina</Label>
                  <StickerSearch
                    stickers={stickersFiltrados}
                    value={form.sticker_id}
                    onChange={(v) => setForm({ ...form, sticker_id: v })}
                    disabled={!selectedAlbum}
                    placeholder={selectedAlbum ? 'Buscar lámina...' : 'Primero elige un álbum'}
                  />
                </div>

                {/* Imágenes múltiples */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Imágenes ({totalImages})</Label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Agregar imágenes
                    </button>
                  </div>
                  <input
                    ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  {totalImages === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-xs">Click para subir imágenes</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {existingImages.map((img, idx) => (
                        <div key={img.id} className="relative group">
                          <div className="relative h-16 w-full rounded overflow-hidden bg-gray-100">
                            <Image src={img.url} alt="" fill className="object-cover" unoptimized />
                          </div>
                          {idx === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-blue-600 text-white leading-4">Principal</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeExisting(img.id)}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      {pendingImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <div className="relative h-16 w-full rounded overflow-hidden bg-gray-100 border-2 border-dashed border-blue-300">
                            <Image src={img.preview} alt="" fill className="object-cover" unoptimized />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePending(idx)}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="h-16 w-full rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  )}
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imagen_url ? (
                        <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                          <Image src={item.imagen_url} alt={`#${item.stickers?.numero}`} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-gray-300" />
                        </div>
                      )}
                      <span className="font-medium text-gray-900">#{item.stickers?.numero}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{item.stickers?.albums?.nombre}</p>
                    <p className="text-xs text-gray-400">{item.stickers?.albums?.collection_types?.nombre} — {item.stickers?.albums?.anio}</p>
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
                      <button onClick={() => setAdjustItem(item)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Ajustar stock">
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
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

      {adjustItem && (
        <StockAdjustModal
          open={!!adjustItem}
          onClose={() => setAdjustItem(null)}
          tabla="stock_stickers"
          item={{
            id: adjustItem.id,
            cantidad: adjustItem.cantidad,
            nombre: `#${adjustItem.stickers?.numero} — ${adjustItem.stickers?.albums?.nombre}`,
            precio_compra: adjustItem.precio_compra,
            precio_venta: adjustItem.precio_venta,
          }}
        />
      )}
    </div>
  )
}

function StickerSearch({ stickers, value, onChange, disabled, placeholder }: {
  stickers: any[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = stickers.find((s) => String(s.id) === value)

  const filteredS = query.length === 0
    ? stickers
    : stickers.filter((s) => {
        const label = s.descripcion ? `${s.descripcion}` : `#${s.numero}`
        return label.toLowerCase().includes(query.toLowerCase())
      })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        placeholder={selected ? (selected.descripcion ?? `#${selected.numero}`) : placeholder}
        value={open ? query : (selected ? (selected.descripcion ?? `#${selected.numero}`) : '')}
        onChange={(e) => { setQuery(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => { if (!disabled) setOpen(true) }}
        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filteredS.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
          ) : filteredS.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => { onChange(String(s.id)); setQuery(''); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${String(s.id) === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
            >
              {s.descripcion ?? `#${s.numero}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
