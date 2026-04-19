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
import { Plus, Pencil, Trash2, BookOpen, ImageIcon } from 'lucide-react'
import { Album, CollectionType } from '@/lib/types'
import Image from 'next/image'

interface Props {
  albums: Album[]
  collectionTypes: CollectionType[]
  isAdmin: boolean
}

const typeColors: Record<string, string> = {
  'Mundiales': 'default',
  'Copa América': 'success',
  'Otros Torneos': 'warning',
}

export default function CollectionsClient({ albums, collectionTypes, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Album | null>(null)
  const [form, setForm] = useState({
    type_id: '', nombre: '', anio: String(new Date().getFullYear()),
    edicion: '', total_laminas: '0',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<number | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({ type_id: '', nombre: '', anio: String(new Date().getFullYear()), edicion: '', total_laminas: '0' })
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(album: Album) {
    setEditing(album)
    setForm({
      type_id: String(album.type_id),
      nombre: album.nombre,
      anio: String(album.anio),
      edicion: album.edicion ?? '',
      total_laminas: String(album.total_laminas),
    })
    setImageFile(null)
    setImagePreview(album.imagen_url)
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
    const ext = imageFile.name.split('.').pop()
    const path = `albums/${albumId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('album-images').upload(path, imageFile, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('album-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = {
      type_id: Number(form.type_id),
      nombre: form.nombre,
      anio: Number(form.anio),
      edicion: form.edicion || null,
      total_laminas: Number(form.total_laminas),
      activo: true,
    }

    if (editing) {
      await supabase.from('albums').update(payload).eq('id', editing.id)
      if (imageFile) {
        const url = await uploadImage(editing.id)
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', editing.id)
      }
    } else {
      const { data: newAlbum } = await supabase.from('albums').insert(payload).select().single()
      if (newAlbum && imageFile) {
        const url = await uploadImage(newAlbum.id)
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', newAlbum.id)
      }
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    const { data: activeStock } = await supabase
      .from('stock_albums').select('id, cantidad').eq('album_id', id).gt('cantidad', 0)
    if (activeStock?.length) {
      const total = activeStock.reduce((a: number, s: any) => a + s.cantidad, 0)
      alert(`No se puede eliminar: el álbum tiene ${total} unidad(es) en stock. Reduce el stock a 0 primero.`)
      return
    }

    const { data: allStock } = await supabase
      .from('stock_albums').select('id').eq('album_id', id)
    if (allStock?.length) {
      const ids = allStock.map((s: any) => s.id)
      const { count } = await supabase
        .from('sale_items').select('id', { count: 'exact', head: true })
        .eq('tipo', 'album').in('referencia_id', ids)
      if (count && count > 0) {
        alert('No se puede eliminar: el álbum tiene historial de ventas registradas.')
        return
      }
    }

    const { data: stickers } = await supabase
      .from('stickers').select('id').eq('album_id', id)
    if (stickers?.length) {
      const stickerIds = stickers.map((s: any) => s.id)
      const { data: stickerStock } = await supabase
        .from('stock_stickers').select('id').in('sticker_id', stickerIds)
      if (stickerStock?.length) {
        const stockIds = stickerStock.map((s: any) => s.id)
        const { count } = await supabase
          .from('sale_items').select('id', { count: 'exact', head: true })
          .eq('tipo', 'sticker').in('referencia_id', stockIds)
        if (count && count > 0) {
          alert('No se puede eliminar: el álbum tiene láminas con historial de ventas.')
          return
        }
        await supabase.from('stock_stickers').delete().in('sticker_id', stickerIds)
      }
      await supabase.from('stickers').delete().eq('album_id', id)
    }

    if (allStock?.length) await supabase.from('stock_albums').delete().eq('album_id', id)
    if (!confirm('¿Eliminar este álbum y todos sus datos asociados?')) return
    await supabase.from('albums').delete().eq('id', id)
    router.refresh()
  }

  async function toggleActivo(album: Album) {
    await supabase.from('albums').update({ activo: !album.activo }).eq('id', album.id)
    router.refresh()
  }

  const grouped = collectionTypes.map((type) => ({
    type,
    items: albums.filter((a) =>
      a.type_id === type.id && (filterType === 'all' || filterType === type.id)
    ),
  })).filter((g) => filterType === 'all' || g.type.id === filterType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Álbumes</h1>
          <p className="text-gray-500 mt-1">Catálogo de colecciones Panini por tipo</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro por tipo */}
          <Select
            value={String(filterType)}
            onValueChange={(v) => setFilterType(v === 'all' ? 'all' : Number(v))}
          >
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {collectionTypes.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" /> Nuevo álbum
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar álbum' : 'Nuevo álbum'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label>Tipo de torneo</Label>
                    <Select value={form.type_id} onValueChange={(v) => setForm({ ...form, type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                      <SelectContent>
                        {collectionTypes.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nombre</Label>
                      <Input placeholder="Ej: Qatar 2022" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Año</Label>
                      <Input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Edición (opcional)</Label>
                      <Input placeholder="Ej: Hard cover" value={form.edicion} onChange={(e) => setForm({ ...form, edicion: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Total láminas</Label>
                      <Input type="number" min="0" value={form.total_laminas} onChange={(e) => setForm({ ...form, total_laminas: e.target.value })} />
                    </div>
                  </div>

                  {/* Imagen */}
                  <div className="space-y-1.5">
                    <Label>Imagen de portada</Label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      {imagePreview ? (
                        <div className="relative w-full h-36">
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
                    {imageFile && <p className="text-xs text-green-600">✓ {imageFile.name}</p>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear álbum'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Grid agrupado por tipo */}
      <div className="space-y-8">
        {grouped.map(({ type, items }) => (
          <div key={type.id}>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={(typeColors[type.nombre] as any) ?? 'secondary'}>{type.nombre}</Badge>
              <span className="text-sm text-gray-400">({items.length} álbum{items.length !== 1 ? 'es' : ''})</span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-400 pl-2">No hay álbumes en esta categoría.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((album) => (
                  <div key={album.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col ${album.activo ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                    {/* Portada */}
                    <div className="relative bg-gray-100 aspect-[3/4]">
                      {album.imagen_url ? (
                        <Image src={album.imagen_url} alt={album.nombre} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-gray-300" />
                        </div>
                      )}
                      {!album.activo && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <Badge variant="outline">Inactivo</Badge>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{album.nombre}</p>
                      <p className="text-xs text-gray-400">{album.anio}</p>
                      {album.edicion && <p className="text-xs text-blue-500 mt-0.5">{album.edicion}</p>}
                      <p className="text-xs text-gray-400 mt-1">{album.total_laminas} láminas</p>

                      {isAdmin && (
                        <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => openEdit(album)}
                            className="flex-1 text-xs text-blue-600 hover:bg-blue-50 rounded py-1 transition-colors"
                          >
                            <Pencil className="h-3 w-3 inline mr-1" />Editar
                          </button>
                          <button
                            onClick={() => toggleActivo(album)}
                            className={`flex-1 text-xs rounded py-1 transition-colors ${album.activo ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                          >
                            {album.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => handleDelete(album.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
