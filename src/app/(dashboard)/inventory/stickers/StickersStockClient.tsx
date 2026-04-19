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
import { Plus, Pencil, Trash2, ArrowLeft, Filter, SlidersHorizontal, ImageIcon } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import StockAdjustModal from '@/components/ui/stock-adjust-modal'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Álbumes únicos derivados de los stickers del catálogo
  const albums = Array.from(
    new Map(stickers.map((s) => [s.album_id, s.albums])).entries()
  ).map(([id, album]) => ({ id, ...album }))

  // Láminas filtradas por álbum seleccionado, ordenadas alfabéticamente por descripción
  const stickersFiltrados = selectedAlbum
    ? stickers
        .filter((s) => String(s.album_id) === selectedAlbum)
        .sort((a, b) => {
          const da = a.descripcion ?? String(a.numero)
          const db = b.descripcion ?? String(b.numero)
          return da.localeCompare(db, 'es', { numeric: true })
        })
    : []

  function openCreate() {
    setEditing(null)
    setSelectedAlbum('')
    setImageFile(null)
    setImagePreview(null)
    setForm({ sticker_id: '', cantidad: '1', precio_compra: '', precio_venta: '', fecha_compra: new Date().toISOString().split('T')[0], es_repetida: 'false', notas: '' })
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setSelectedAlbum(String(item.stickers?.album_id ?? ''))
    setImageFile(null)
    setImagePreview(item.imagen_url ?? null)
    setForm({
      sticker_id: String(item.sticker_id), cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra), precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra, es_repetida: String(item.es_repetida), notas: item.notas ?? '',
    })
    setOpen(true)
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()
    const path = `stickers/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('sticker-images').upload(path, imageFile, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('sticker-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const imagenUrl = imageFile ? await uploadImage() : undefined
    const payload: any = {
      sticker_id: Number(form.sticker_id), cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra), precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra, es_repetida: form.es_repetida === 'true',
      notas: form.notas || null, usuario_id: user!.id,
    }
    if (imagenUrl) payload.imagen_url = imagenUrl
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
                  <Label>Álbum</Label>
                  <Select
                    value={selectedAlbum}
                    onValueChange={(v) => {
                      setSelectedAlbum(v)
                      setForm((f) => ({ ...f, sticker_id: '' }))
                    }}
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
                {/* Imagen */}
                <div className="space-y-1.5">
                  <Label>Imagen (opcional)</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {imagePreview ? (
                      <div className="relative w-full h-28">
                        <Image src={imagePreview} alt="Preview" fill className="object-contain rounded" unoptimized />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-xs">Click para subir imagen</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageFile(file)
                      setImagePreview(URL.createObjectURL(file))
                    }}
                  />
                  {imageFile && <p className="text-xs text-green-600">✓ {imageFile.name}</p>}
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

  const filtered = query.length === 0
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

  function selectItem(s: any) {
    onChange(String(s.id))
    setQuery('')
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        placeholder={selected ? (selected.descripcion ?? `#${selected.numero}`) : placeholder}
        value={open ? query : (selected ? (selected.descripcion ?? `#${selected.numero}`) : '')}
        onChange={handleInputChange}
        onFocus={() => { if (!disabled) setOpen(true) }}
        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
          ) : filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => selectItem(s)}
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
