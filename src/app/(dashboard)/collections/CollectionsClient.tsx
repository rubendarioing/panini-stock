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
import { Plus, Pencil, Trash2, Globe } from 'lucide-react'
import { Collection, CollectionType } from '@/lib/types'

interface Props {
  collections: (Collection & { collection_types: CollectionType })[]
  collectionTypes: CollectionType[]
  isAdmin: boolean
}

const typeColors: Record<string, string> = {
  'Mundiales': 'default',
  'Copa América': 'success',
  'Otros Torneos': 'warning',
}

export default function CollectionsClient({ collections, collectionTypes, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [form, setForm] = useState({ type_id: '', nombre: '', anio: '', descripcion: '' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openCreate() {
    setEditing(null)
    setForm({ type_id: '', nombre: '', anio: new Date().getFullYear().toString(), descripcion: '' })
    setOpen(true)
  }

  function openEdit(col: Collection) {
    setEditing(col)
    setForm({
      type_id: String(col.type_id),
      nombre: col.nombre,
      anio: String(col.anio),
      descripcion: col.descripcion ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      type_id: Number(form.type_id),
      nombre: form.nombre,
      anio: Number(form.anio),
      descripcion: form.descripcion || null,
    }

    if (editing) {
      await supabase.from('collections').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('collections').insert({ ...payload, activo: true })
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta colección?')) return
    await supabase.from('collections').delete().eq('id', id)
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nueva colección
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar colección' : 'Nueva colección'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Categoría</Label>
                  <Select value={form.type_id} onValueChange={(v) => setForm({ ...form, type_id: v })}>
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
                  <Input
                    placeholder="Ej: Qatar 2022"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Año</Label>
                  <Input
                    type="number"
                    value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción (opcional)</Label>
                  <Input
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((col) => (
                  <div key={col.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={(typeColors[type.nombre] as any) ?? 'secondary'}>
                            {col.anio}
                          </Badge>
                          {!col.activo && <Badge variant="outline">Inactivo</Badge>}
                        </div>
                        <h3 className="font-semibold text-gray-900">{col.nombre}</h3>
                        {col.descripcion && (
                          <p className="text-sm text-gray-500 mt-1">{col.descripcion}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => openEdit(col)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(col.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
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
