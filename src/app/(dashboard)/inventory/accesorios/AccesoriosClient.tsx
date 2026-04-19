'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, ArrowLeft, ImageIcon, SlidersHorizontal } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import StockAdjustModal from '@/components/ui/stock-adjust-modal'

const condicionColors: Record<string, string> = {
  nuevo: 'success', sellado: 'default', usado: 'warning',
}

export default function AccesoriosClient({ stock, albums }: { stock: any[]; albums: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    album_id: '', tipo: 'sobre', cantidad_contenido: '',
    cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    condicion: 'nuevo', notas: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterTipo, setFilterTipo] = useState('all')
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({
      album_id: '', tipo: 'sobre', cantidad_contenido: '',
      cantidad: '1', precio_compra: '', precio_venta: '',
      fecha_compra: new Date().toISOString().split('T')[0],
      condicion: 'nuevo', notas: '',
    })
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      album_id: String(item.album_id),
      tipo: item.tipo,
      cantidad_contenido: item.cantidad_contenido ? String(item.cantidad_contenido) : '',
      cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra),
      precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra,
      condicion: item.condicion,
      notas: item.notas ?? '',
    })
    setImageFile(null)
    setImagePreview(item.imagen_url ?? null)
    setOpen(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(id: number): Promise<string | null> {
    if (!imageFile) return null
    setUploading(true)
    const ext = imageFile.name.split('.').pop()
    const path = `accesorios/${id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('album-images').upload(path, imageFile, { upsert: true })
    setUploading(false)
    if (error) return null
    const { data } = supabase.storage.from('album-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload: any = {
      album_id: Number(form.album_id),
      tipo: form.tipo,
      cantidad_contenido: form.cantidad_contenido ? Number(form.cantidad_contenido) : null,
      cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra),
      precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra,
      condicion: form.condicion,
      notas: form.notas || null,
      usuario_id: user!.id,
    }

    if (editing) {
      const { error } = await supabase.from('stock_accesorios').update(payload).eq('id', editing.id)
      if (error) { alert(`Error al actualizar: ${error.message}`); setLoading(false); return }
      if (imageFile) {
        const url = await uploadImage(editing.id)
        if (url) await supabase.from('stock_accesorios').update({ imagen_url: url }).eq('id', editing.id)
      }
    } else {
      const { data: inserted, error } = await supabase.from('stock_accesorios').insert(payload).select('id').single()
      if (error) { alert(`Error al guardar: ${error.message}`); setLoading(false); return }
      if (imageFile && inserted) {
        const url = await uploadImage(inserted.id)
        if (url) await supabase.from('stock_accesorios').update({ imagen_url: url }).eq('id', inserted.id)
      }
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    const item = stock.find((s: any) => s.id === id)
    if (item?.cantidad > 0) {
      alert(`No se puede eliminar: tiene ${item.cantidad} unidad(es) en stock. Ajusta el stock a 0 primero.`)
      return
    }
    const { count: ventasCount } = await supabase
      .from('sale_items').select('id', { count: 'exact', head: true })
      .eq('tipo', 'accesorio').eq('referencia_id', id)
    if (ventasCount && ventasCount > 0) {
      alert('No se puede eliminar: tiene historial de ventas registradas.')
      return
    }
    const { count: comboCount } = await supabase
      .from('combo_items').select('id', { count: 'exact', head: true })
      .eq('stock_accesorio_id', id)
    if (comboCount && comboCount > 0) {
      alert('No se puede eliminar: está incluido en un combo.')
      return
    }
    if (!confirm('¿Eliminar este registro de stock?')) return
    await supabase.from('stock_accesorios').delete().eq('id', id)
    router.refresh()
  }

  const filtered = filterTipo === 'all' ? stock : stock.filter(s => s.tipo === filterTipo)

  const totalSobres = stock.filter(s => s.tipo === 'sobre').reduce((a, s) => a + s.cantidad, 0)
  const totalCajas  = stock.filter(s => s.tipo === 'caja').reduce((a, s) => a + s.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock de Accesorios</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              <span className="font-medium text-blue-600">{totalSobres} sobres</span>
              {' · '}
              <span className="font-medium text-orange-500">{totalCajas} cajas selladas</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="sobre">Sobres</option>
            <option value="caja">Cajas selladas</option>
          </select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Agregar stock</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar accesorio' : 'Nuevo accesorio'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sobre">Sobre</SelectItem>
                        <SelectItem value="caja">Caja Sellada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{form.tipo === 'sobre' ? 'Láminas por sobre' : 'Sobres por caja'}</Label>
                    <Input
                      type="number" min="1"
                      placeholder={form.tipo === 'sobre' ? 'Ej: 5' : 'Ej: 36'}
                      value={form.cantidad_contenido}
                      onChange={(e) => setForm({ ...form, cantidad_contenido: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Álbum</Label>
                  <Select value={form.album_id} onValueChange={(v) => setForm({ ...form, album_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar álbum..." /></SelectTrigger>
                    <SelectContent>
                      {albums.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.collection_types?.nombre} — {a.nombre} {a.anio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Imagen</Label>
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
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {imageFile && <p className="text-xs text-green-600">Imagen lista: {imageFile.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div className="space-y-1.5">
                    <Label>Cantidad</Label>
                    <Input type="number" min="0" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
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
                  <Button type="submit" disabled={loading || uploading} className="flex-1">
                    {uploading ? 'Subiendo imagen...' : loading ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
                  </Button>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Álbum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contenido</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Condición</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Compra</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">P. Venta</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Margen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No hay accesorios registrados</td></tr>
              ) : filtered.map((item) => {
                const margen = item.precio_venta - item.precio_compra
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imagen_url ? (
                          <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                            <Image src={item.imagen_url} alt={item.albums?.nombre} fill className="object-cover" unoptimized />
                          </div>
                        ) : item.albums?.imagen_url ? (
                          <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                            <Image src={item.albums.imagen_url} alt={item.albums.nombre} fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.albums?.nombre}</p>
                          <p className="text-xs text-gray-400">{item.albums?.collection_types?.nombre} — {item.albums?.anio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.tipo === 'sobre' ? 'secondary' : 'warning'}>
                        {item.tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.cantidad_contenido
                        ? `${item.cantidad_contenido} ${item.tipo === 'sobre' ? 'láminas' : 'sobres'}`
                        : '—'}
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustItem && (
        <StockAdjustModal
          open={!!adjustItem}
          onClose={() => setAdjustItem(null)}
          tabla="stock_accesorios"
          item={{
            id: adjustItem.id,
            cantidad: adjustItem.cantidad,
            nombre: `${adjustItem.tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'} — ${adjustItem.albums?.nombre} ${adjustItem.albums?.anio}`,
            precio_compra: adjustItem.precio_compra,
            precio_venta: adjustItem.precio_venta,
          }}
        />
      )}
    </div>
  )
}
