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
import { Plus, Pencil, Trash2, Globe, BookOpen, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'
import { Collection, CollectionType, Album } from '@/lib/types'
import Image from 'next/image'

interface Props {
  collections: (Collection & { collection_types: CollectionType })[]
  collectionTypes: CollectionType[]
  albums: (Album & { collections?: Collection })[]
  isAdmin: boolean
}

const typeColors: Record<string, string> = {
  'Mundiales': 'default', 'Copa América': 'success', 'Otros Torneos': 'warning',
}

export default function CollectionsClient({ collections, collectionTypes, albums, isAdmin }: Props) {
  const [openCol, setOpenCol] = useState(false)
  const [openAlbum, setOpenAlbum] = useState(false)
  const [editingCol, setEditingCol] = useState<Collection | null>(null)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [expandedCol, setExpandedCol] = useState<number | null>(null)
  const [colForm, setColForm] = useState({ type_id: '', nombre: '', anio: '', descripcion: '' })
  const [albumForm, setAlbumForm] = useState({ collection_id: '', nombre: '', edicion: '', total_laminas: '0' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // --- Colecciones ---
  function openCreateCol() {
    setEditingCol(null)
    setColForm({ type_id: '', nombre: '', anio: new Date().getFullYear().toString(), descripcion: '' })
    setOpenCol(true)
  }

  function openEditCol(col: Collection) {
    setEditingCol(col)
    setColForm({ type_id: String(col.type_id), nombre: col.nombre, anio: String(col.anio), descripcion: col.descripcion ?? '' })
    setOpenCol(true)
  }

  async function handleColSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = { type_id: Number(colForm.type_id), nombre: colForm.nombre, anio: Number(colForm.anio), descripcion: colForm.descripcion || null }
    if (editingCol) {
      await supabase.from('collections').update(payload).eq('id', editingCol.id)
    } else {
      await supabase.from('collections').insert({ ...payload, activo: true })
    }
    setLoading(false)
    setOpenCol(false)
    router.refresh()
  }

  async function handleDeleteCol(id: number) {
    if (!confirm('¿Eliminar esta colección y todos sus álbumes?')) return
    await supabase.from('collections').delete().eq('id', id)
    router.refresh()
  }

  // --- Álbumes ---
  function openCreateAlbum(collectionId: number) {
    setEditingAlbum(null)
    setAlbumForm({ collection_id: String(collectionId), nombre: '', edicion: '', total_laminas: '0' })
    setImageFile(null)
    setImagePreview(null)
    setOpenAlbum(true)
  }

  function openEditAlbum(album: Album) {
    setEditingAlbum(album)
    setAlbumForm({ collection_id: String(album.collection_id), nombre: album.nombre, edicion: album.edicion ?? '', total_laminas: String(album.total_laminas) })
    setImageFile(null)
    setImagePreview(album.imagen_url ?? null)
    setOpenAlbum(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadAlbumImage(albumId: number): Promise<string | null> {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()
    const path = `albums/${albumId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('album-images').upload(path, imageFile, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('album-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleAlbumSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      collection_id: Number(albumForm.collection_id),
      nombre: albumForm.nombre,
      edicion: albumForm.edicion || null,
      total_laminas: Number(albumForm.total_laminas),
    }

    if (editingAlbum) {
      await supabase.from('albums').update(payload).eq('id', editingAlbum.id)
      if (imageFile) {
        const url = await uploadAlbumImage(editingAlbum.id)
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', editingAlbum.id)
      }
    } else {
      const { data: newAlbum } = await supabase.from('albums').insert(payload).select().single()
      if (newAlbum && imageFile) {
        const url = await uploadAlbumImage(newAlbum.id)
        if (url) await supabase.from('albums').update({ imagen_url: url }).eq('id', newAlbum.id)
      }
    }

    setLoading(false)
    setOpenAlbum(false)
    router.refresh()
  }

  async function handleDeleteAlbum(id: number) {
    if (!confirm('¿Eliminar este álbum?')) return
    await supabase.from('albums').delete().eq('id', id)
    router.refresh()
  }

  const grouped = collectionTypes.map((type) => ({
    type,
    items: collections.filter((c) => c.type_id === type.id),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Colecciones</h1>
          <p className="text-gray-500 mt-1">Álbumes Panini organizados por torneo</p>
        </div>
        {isAdmin && (
          <Dialog open={openCol} onOpenChange={setOpenCol}>
            <DialogTrigger asChild>
              <Button onClick={openCreateCol}><Plus className="h-4 w-4 mr-2" /> Nueva colección</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCol ? 'Editar colección' : 'Nueva colección'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleColSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Categoría</Label>
                  <Select value={colForm.type_id} onValueChange={(v) => setColForm({ ...colForm, type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {collectionTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input placeholder="Ej: Qatar 2022" value={colForm.nombre} onChange={(e) => setColForm({ ...colForm, nombre: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Año</Label>
                  <Input type="number" value={colForm.anio} onChange={(e) => setColForm({ ...colForm, anio: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción (opcional)</Label>
                  <Input value={colForm.descripcion} onChange={(e) => setColForm({ ...colForm, descripcion: e.target.value })} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando...' : editingCol ? 'Actualizar' : 'Crear'}</Button>
                  <Button type="button" variant="outline" onClick={() => setOpenCol(false)} className="flex-1">Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Modal álbum */}
      <Dialog open={openAlbum} onOpenChange={setOpenAlbum}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAlbum ? 'Editar álbum' : 'Nuevo álbum'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlbumSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre del álbum</Label>
              <Input placeholder="Ej: Álbum oficial" value={albumForm.nombre} onChange={(e) => setAlbumForm({ ...albumForm, nombre: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Edición (opcional)</Label>
                <Input placeholder="Ej: Edición especial" value={albumForm.edicion} onChange={(e) => setAlbumForm({ ...albumForm, edicion: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Total láminas</Label>
                <Input type="number" min="0" value={albumForm.total_laminas} onChange={(e) => setAlbumForm({ ...albumForm, total_laminas: e.target.value })} />
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
              <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando...' : editingAlbum ? 'Actualizar' : 'Crear álbum'}</Button>
              <Button type="button" variant="outline" onClick={() => setOpenAlbum(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        {grouped.map(({ type, items }) => (
          <div key={type.id}>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-700">{type.nombre}</h2>
              <span className="text-sm text-gray-400">({items.length})</span>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 pl-7">No hay colecciones en esta categoría</p>
            ) : (
              <div className="space-y-3">
                {items.map((col) => {
                  const colAlbums = albums.filter(a => a.collection_id === col.id)
                  const isExpanded = expandedCol === col.id
                  return (
                    <div key={col.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Header colección */}
                      <div className="flex items-center justify-between p-4">
                        <button
                          onClick={() => setExpandedCol(isExpanded ? null : col.id)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={(typeColors[type.nombre] as any) ?? 'secondary'}>{col.anio}</Badge>
                              <span className="font-semibold text-gray-900">{col.nombre}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{colAlbums.length} álbum{colAlbums.length !== 1 ? 'es' : ''}</p>
                          </div>
                        </button>
                        {isAdmin && (
                          <div className="flex gap-1 items-center">
                            <Button size="sm" variant="outline" onClick={() => openCreateAlbum(col.id)}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Álbum
                            </Button>
                            <button onClick={() => openEditCol(col)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteCol(col.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Álbumes expandidos */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4">
                          {colAlbums.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-2">No hay álbumes. Agrega el primero.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                              {colAlbums.map((album) => (
                                <div key={album.id} className="border border-gray-100 rounded-lg overflow-hidden bg-gray-50 hover:border-blue-200 transition-colors">
                                  <div className="relative h-28 bg-gray-100">
                                    {album.imagen_url ? (
                                      <Image src={album.imagen_url} alt={album.nombre} fill className="object-cover" unoptimized />
                                    ) : (
                                      <div className="h-full flex items-center justify-center">
                                        <BookOpen className="h-8 w-8 text-gray-300" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs font-medium text-gray-900 truncate">{album.nombre}</p>
                                    {album.edicion && <p className="text-xs text-gray-400 truncate">{album.edicion}</p>}
                                    <p className="text-xs text-gray-400">{album.total_laminas} láminas</p>
                                    {isAdmin && (
                                      <div className="flex gap-1 mt-2">
                                        <button onClick={() => openEditAlbum(album)} className="flex-1 text-xs text-blue-600 hover:bg-blue-50 rounded py-0.5">
                                          Editar
                                        </button>
                                        <button onClick={() => handleDeleteAlbum(album.id)} className="flex-1 text-xs text-red-500 hover:bg-red-50 rounded py-0.5">
                                          Eliminar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
