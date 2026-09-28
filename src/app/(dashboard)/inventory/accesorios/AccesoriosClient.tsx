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
import { Plus, Pencil, Trash2, ArrowLeft, ImageIcon, SlidersHorizontal, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import StockAdjustModal from '@/components/ui/stock-adjust-modal'

interface ExistingImage { id: number; url: string; orden: number }
interface PendingImage  { file: File; preview: string }

const condicionColors: Record<string, string> = {
  nuevo: 'success', sellado: 'default', usado: 'warning',
}

export default function AccesoriosClient({ variantes, albums }: { variantes: any[]; albums: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    album_id: '', tipo: 'sobre', cantidad_contenido: '',
    cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    condicion: 'nuevo', notas: '',
  })
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([])
  const [pendingImages, setPendingImages]   = useState<PendingImage[]>([])
  const [removedIds, setRemovedIds]         = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [filterTipo, setFilterTipo] = useState('all')
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Sobres/cajas no tienen catálogo propio (a diferencia de albums/stickers): el
  // "producto" (categoría Sobre/Caja de un álbum) se crea la primera vez que se
  // registra stock para ese álbum+tipo, y se reutiliza después.
  async function findOrCreateProducto(albumId: number, tipo: string, album: any): Promise<number | null> {
    const legacyTable = `stock_accesorios_${tipo}`
    const { data: existing } = await supabase
      .from('productos').select('id')
      .eq('legacy_table', legacyTable).eq('legacy_id', albumId)
      .maybeSingle()
    if (existing) return existing.id

    const { data: categoria } = await supabase.from('categorias').select('id').eq('slug', tipo).single()
    if (!categoria) return null

    const { data: created, error } = await supabase.from('productos').insert({
      categoria_id: categoria.id,
      type_id: album?.type_id ?? null,
      anio: album?.anio ?? null,
      nombre: `${album?.nombre ?? ''} - ${tipo === 'sobre' ? 'Sobre' : 'Caja'}`,
      activo: true,
      legacy_table: legacyTable,
      legacy_id: albumId,
    }).select('id').single()

    return error ? null : (created?.id ?? null)
  }

  function resetImages() {
    setExistingImages([])
    setPendingImages([])
    setRemovedIds([])
  }

  function openCreate() {
    setEditing(null)
    setForm({
      album_id: '', tipo: 'sobre', cantidad_contenido: '',
      cantidad: '1', precio_compra: '', precio_venta: '',
      fecha_compra: new Date().toISOString().split('T')[0],
      condicion: 'nuevo', notas: '',
    })
    resetImages()
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      album_id: String(item.productos?.legacy_id ?? ''),
      tipo: item.productos?.categorias?.slug ?? 'sobre',
      cantidad_contenido: item.unidades_contenidas ? String(item.unidades_contenidas) : '',
      cantidad: String(item.inventario?.cantidad ?? 0),
      precio_compra: String(item.precio_compra),
      precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra,
      condicion: item.condicion,
      notas: item.notas ?? '',
    })
    resetImages()
    setExistingImages(item.producto_variante_imagenes ?? [])
    setOpen(true)
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

  async function saveImages(varianteId: number) {
    if (removedIds.length > 0) {
      await supabase.from('producto_variante_imagenes').delete().in('id', removedIds)
    }
    if (pendingImages.length > 0) {
      const { data: last } = await supabase
        .from('producto_variante_imagenes').select('orden')
        .eq('variante_id', varianteId)
        .order('orden', { ascending: false }).limit(1)
      let nextOrden = last?.[0] ? last[0].orden + 1 : 0
      for (const { file } of pendingImages) {
        const ext = file.name.split('.').pop()
        const path = `accesorios/${varianteId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('album-images').upload(path, file, { upsert: true })
        if (!error) {
          const { data } = supabase.storage.from('album-images').getPublicUrl(path)
          await supabase.from('producto_variante_imagenes').insert({ variante_id: varianteId, url: data.publicUrl, orden: nextOrden++ })
        }
      }
    }
    const { data: first } = await supabase
      .from('producto_variante_imagenes').select('url')
      .eq('variante_id', varianteId)
      .order('orden').limit(1).maybeSingle()
    await supabase.from('producto_variantes').update({ imagen_url: first?.url ?? null }).eq('id', varianteId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const album = albums.find((a: any) => String(a.id) === form.album_id)
    const productoId = await findOrCreateProducto(Number(form.album_id), form.tipo, album)
    if (!productoId) { alert('Error al preparar el producto.'); setLoading(false); return }

    const payload: any = {
      producto_id: productoId,
      unidades_contenidas: form.cantidad_contenido ? Number(form.cantidad_contenido) : null,
      precio_compra: Number(form.precio_compra),
      precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra,
      condicion: form.condicion,
      notas: form.notas || null,
      usuario_id: user!.id,
    }
    if (editing) {
      const { error } = await supabase.from('producto_variantes').update(payload).eq('id', editing.id)
      if (error) { alert(`Error al actualizar: ${error.message}`); setLoading(false); return }
      await supabase.from('inventario').update({ cantidad: Number(form.cantidad) }).eq('variante_id', editing.id)
      await saveImages(editing.id)
    } else {
      const { data: inserted, error } = await supabase.from('producto_variantes').insert(payload).select('id').single()
      if (error) { alert(`Error al guardar: ${error.message}`); setLoading(false); return }
      if (inserted) {
        await supabase.from('inventario').insert({ variante_id: inserted.id, cantidad: Number(form.cantidad) })
        await saveImages(inserted.id)
      }
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    const item = variantes.find((s: any) => s.id === id)
    if ((item?.inventario?.cantidad ?? 0) > 0) {
      alert(`No se puede eliminar: tiene ${item.inventario.cantidad} unidad(es) en stock. Ajusta el stock a 0 primero.`)
      return
    }
    const { count: ventasCount } = await supabase
      .from('sale_items_v2').select('id', { count: 'exact', head: true })
      .eq('variante_id', id)
    if (ventasCount && ventasCount > 0) {
      alert('No se puede eliminar: tiene historial de ventas registradas.')
      return
    }
    const { count: comboCount } = await supabase
      .from('combo_componentes').select('id', { count: 'exact', head: true })
      .eq('variante_id', id)
    if (comboCount && comboCount > 0) {
      alert('No se puede eliminar: está incluido en un combo.')
      return
    }
    if (!confirm('¿Eliminar este registro de stock?')) return
    await supabase.from('producto_variante_imagenes').delete().eq('variante_id', id)
    await supabase.from('inventario').delete().eq('variante_id', id)
    await supabase.from('producto_variantes').delete().eq('id', id)
    router.refresh()
  }

  const filtered = filterTipo === 'all' ? variantes : variantes.filter(s => s.productos?.categorias?.slug === filterTipo)
  const totalSobres = variantes.filter(s => s.productos?.categorias?.slug === 'sobre').reduce((a, s) => a + (s.inventario?.cantidad ?? 0), 0)
  const totalCajas  = variantes.filter(s => s.productos?.categorias?.slug === 'caja').reduce((a, s) => a + (s.inventario?.cantidad ?? 0), 0)
  const totalImages = existingImages.length + pendingImages.length

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
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm">Click para subir imágenes</span>
                        <span className="text-xs">PNG, JPG hasta 5MB · selección múltiple</span>
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
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
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
                const tipo = item.productos?.categorias?.slug
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imagen_url ?? item.productos?.imagen_url ? (
                          <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                            <Image src={item.imagen_url ?? item.productos.imagen_url} alt={item.productos?.nombre ?? ''} fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.productos?.nombre}</p>
                          <p className="text-xs text-gray-400">{item.productos?.collection_types?.nombre} — {item.productos?.anio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tipo === 'sobre' ? 'secondary' : 'warning'}>
                        {tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.unidades_contenidas
                        ? `${item.unidades_contenidas} ${tipo === 'sobre' ? 'láminas' : 'sobres'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={condicionColors[item.condicion] as any}>{item.condicion}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.inventario?.cantidad ?? 0}</td>
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
          varianteId={adjustItem.id}
          item={{
            cantidad: adjustItem.inventario?.cantidad ?? 0,
            nombre: `${adjustItem.productos?.categorias?.slug === 'sobre' ? 'Sobre' : 'Caja Sellada'} — ${adjustItem.productos?.nombre} ${adjustItem.productos?.anio}`,
            precio_compra: adjustItem.precio_compra,
            precio_venta: adjustItem.precio_venta,
          }}
        />
      )}
    </div>
  )
}
