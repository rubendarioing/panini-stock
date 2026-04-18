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
import { Plus, Pencil, Trash2, ArrowLeft, Upload, ImageIcon } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'

const condicionColors: Record<string, string> = {
  nuevo: 'success', sellado: 'default', usado: 'warning',
}

export default function AlbumsStockClient({ stock, albums }: { stock: any[]; albums: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    album_id: '', cantidad: '1', precio_compra: '', precio_venta: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    condicion: 'nuevo', estado: 'vacio', notas: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterEstado, setFilterEstado] = useState('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({ album_id: '', cantidad: '1', precio_compra: '', precio_venta: '', fecha_compra: new Date().toISOString().split('T')[0], condicion: 'nuevo', estado: 'vacio', notas: '' })
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      album_id: String(item.album_id), cantidad: String(item.cantidad),
      precio_compra: String(item.precio_compra), precio_venta: String(item.precio_venta),
      fecha_compra: item.fecha_compra, condicion: item.condicion,
      estado: item.estado ?? 'vacio', notas: item.notas ?? '',
    })
    setImageFile(null)
    setImagePreview(item.albums?.imagen_url ?? null)
    setOpen(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(albumId: number): Promise<string | null> {
    if (!imageFile) return null
    setUploading(true)
    const ext = imageFile.name.split('.').pop()
    const path = `albums/${albumId}-${Date.now()}.${ext}`
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

    const payload = {
      album_id: Number(form.album_id), cantidad: Number(form.cantidad),
      precio_compra: Number(form.precio_compra), precio_venta: Number(form.precio_venta),
      fecha_compra: form.fecha_compra, condicion: form.condicion, estado: form.estado,
      notas: form.notas || null, usuario_id: user!.id,
    }

    if (editing) {
      await supabase.from('stock_albums').update(payload).eq('id', editing.id)
      if (imageFile) {
        const url = await uploadImage(Number(form.album_id))
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', Number(form.album_id))
      }
    } else {
      await supabase.from('stock_albums').insert(payload)
      if (imageFile) {
        const url = await uploadImage(Number(form.album_id))
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', Number(form.album_id))
      }
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

  const filtered = stock.filter((s) => {
    if (filterEstado === 'lleno') return s.estado === 'lleno'
    if (filterEstado === 'vacio') return s.estado === 'vacio'
    return true
  })

  const totalLlenos = stock.filter(s => s.estado === 'lleno').reduce((a, s) => a + s.cantidad, 0)
  const totalVacios = stock.filter(s => s.estado === 'vacio').reduce((a, s) => a + s.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock de Álbumes</h1>
            <p className="text-gray-500 mt-0.5">
              <span className="text-green-600 font-medium">{totalLlenos} llenos</span>
              {' · '}
              <span className="text-blue-600 font-medium">{totalVacios} vacíos</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="lleno">Llenos</option>
            <option value="vacio">Vacíos</option>
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Agregar stock</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

                {/* Imagen del álbum */}
                <div className="space-y-1.5">
                  <Label>Imagen del álbum</Label>
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
                    <Label>Estado</Label>
                    <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacio">Vacío</SelectItem>
                        <SelectItem value="lleno">Lleno</SelectItem>
                      </SelectContent>
                    </Select>
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

                <div className="space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input type="number" min="0" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
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
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No hay stock registrado</td></tr>
              ) : filtered.map((item) => {
                const margen = item.precio_venta - item.precio_compra
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.albums?.imagen_url ? (
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
                          <p className="text-xs text-gray-400">{item.albums?.collections?.nombre} {item.albums?.collections?.anio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.estado === 'lleno' ? 'success' : 'secondary'}>
                        {item.estado === 'lleno' ? 'Lleno' : 'Vacío'}
                      </Badge>
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
