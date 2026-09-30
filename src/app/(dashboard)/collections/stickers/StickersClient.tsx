'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Trash2, Layers, Plus, ListPlus, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { esMundial } from '@/lib/product-labels'

export default function StickersClient({ albums, stickers }: { albums: any[]; stickers: any[] }) {
  const [selectedAlbum, setSelectedAlbum] = useState<string>('')
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [loadingSingle, setLoadingSingle] = useState(false)

  // Carga masiva
  const [rangeFrom, setRangeFrom] = useState('1')
  const [rangeTo, setRangeTo] = useState('')
  const [rangePrefix, setRangePrefix] = useState('')
  const [numeroPrefix, setNumeroPrefix] = useState('')

  // Individual
  const [singleNumero, setSingleNumero] = useState('')
  const [singleDesc, setSingleDesc] = useState('')

  // Edición
  const [editing, setEditing] = useState<any | null>(null)
  const [editNumero, setEditNumero] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const album = albums.find((a) => String(a.id) === selectedAlbum)

  const albumStickers = useMemo(
    () => stickers.filter((s) => String(s.album_id) === selectedAlbum),
    [stickers, selectedAlbum]
  )

  // Todos los números del álbum (con o sin descripción): stickers tiene
  // unique(album_id, numero), así que cualquier número repetido falla al insertar.
  const existingNumbers = useMemo(
    () => new Set(albumStickers.map((s) => String(s.numero).toUpperCase())),
    [albumStickers]
  )

  const numeroRango = (n: number) => `${numeroPrefix}${n}`

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAlbum) return
    const from = Number(rangeFrom)
    const to = Number(rangeTo)
    if (from > to || to - from > 999) return

    setLoadingBulk(true)

    const nuevas = []
    for (let n = from; n <= to; n++) {
      const numero = numeroRango(n)
      if (!existingNumbers.has(numero)) {
        nuevas.push({
          album_id: Number(selectedAlbum),
          numero,
          descripcion: rangePrefix ? `${rangePrefix} ${n}` : null,
        })
      }
    }

    let creadas = 0
    let errorMsg: string | null = null
    const CHUNK = 200
    for (let i = 0; i < nuevas.length; i += CHUNK) {
      const lote = nuevas.slice(i, i + CHUNK)
      const { error } = await supabase.from('stickers').insert(lote)
      if (error) { errorMsg = error.message; break }
      creadas += lote.length
    }

    setLoadingBulk(false)
    if (errorMsg) alert(`Se crearon ${creadas} lámina(s) y luego falló: ${errorMsg}`)
    setRangePrefix('')
    setNumeroPrefix('')
    router.refresh()
  }

  async function handleSingle(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAlbum || !singleNumero) return
    const numero = singleNumero.trim().toUpperCase()
    if (existingNumbers.has(numero)) {
      alert(`La lámina #${numero} ya existe en este álbum`)
      return
    }
    setLoadingSingle(true)
    const { error } = await supabase.from('stickers').insert({
      album_id: Number(selectedAlbum),
      numero,
      descripcion: singleDesc || null,
    })
    setLoadingSingle(false)
    if (error) { alert(`No se pudo agregar: ${error.message}`); return }
    setSingleNumero('')
    setSingleDesc('')
    router.refresh()
  }

  function openEdit(s: any) {
    setEditing(s)
    setEditNumero(String(s.numero))
    setEditDesc(s.descripcion ?? '')
  }

  const editNumeroDuplicado = useMemo(() => {
    if (!editing) return false
    const numero = editNumero.trim().toUpperCase()
    return albumStickers.some((s) => s.id !== editing.id && String(s.numero).toUpperCase() === numero)
  }, [editing, editNumero, albumStickers])

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const numero = editNumero.trim().toUpperCase()
    if (!numero || editNumeroDuplicado) return
    setLoadingEdit(true)
    // El trigger trg_sync_producto_from_sticker propaga el cambio a `productos`.
    const { error } = await supabase
      .from('stickers')
      .update({ numero, descripcion: editDesc.trim() || null })
      .eq('id', editing.id)
    setLoadingEdit(false)
    if (error) {
      alert(`No se pudo guardar: ${error.message}`)
      return
    }
    setEditing(null)
    router.refresh()
  }

  async function handleDelete(id: number) {
    // Stock y ventas viven en producto_variantes/inventario/sale_items_v2.
    const { data: producto } = await supabase
      .from('productos')
      .select('id, producto_variantes(id, inventario(cantidad))')
      .eq('legacy_table', 'stickers').eq('legacy_id', id)
      .maybeSingle()

    const varianteIds = (producto?.producto_variantes ?? []).map((v: any) => v.id)
    const stockActivo = (producto?.producto_variantes ?? [])
      .reduce((a: number, v: any) => a + (v.inventario?.cantidad ?? 0), 0)

    if (stockActivo > 0) {
      alert(`No se puede eliminar: tiene ${stockActivo} unidad(es) en stock. Reduce el stock a 0 primero.`)
      return
    }

    if (varianteIds.length) {
      const { count } = await supabase
        .from('sale_items_v2').select('id', { count: 'exact', head: true })
        .in('variante_id', varianteIds)
      if (count && count > 0) {
        alert('No se puede eliminar: la lámina tiene historial de ventas registradas.')
        return
      }
    }

    if (!confirm('¿Eliminar esta lámina del catálogo?')) return
    await supabase.from('stickers').delete().eq('id', id)
    setEditing(null)
    router.refresh()
  }

  async function handleDeleteAll() {
    if (!selectedAlbum) return
    const stickerIds = albumStickers.map((s) => s.id)
    const numeroPorSticker = new Map(albumStickers.map((s) => [s.id, s.numero]))

    // Mismas validaciones que handleDelete, pero para todo el álbum. Se consulta
    // por lotes para no exceder el largo de URL con álbumes grandes.
    const CHUNK = 200
    const conStock: string[] = []
    const varianteIds: number[] = []
    for (let i = 0; i < stickerIds.length; i += CHUNK) {
      const { data: productos, error } = await supabase
        .from('productos')
        .select('legacy_id, producto_variantes(id, inventario(cantidad))')
        .eq('legacy_table', 'stickers')
        .in('legacy_id', stickerIds.slice(i, i + CHUNK))
      if (error) {
        alert(`No se pudo validar el stock: ${error.message}`)
        return
      }
      for (const p of productos ?? []) {
        const variantes: any[] = p.producto_variantes ?? []
        variantes.forEach((v) => varianteIds.push(v.id))
        const stock = variantes.reduce((a: number, v: any) => a + (v.inventario?.cantidad ?? 0), 0)
        if (stock > 0) conStock.push(`#${numeroPorSticker.get(p.legacy_id)}`)
      }
    }

    if (conStock.length > 0) {
      const muestra = conStock.slice(0, 10).join(', ') + (conStock.length > 10 ? '…' : '')
      alert(`No se puede eliminar: ${conStock.length} lámina(s) tienen stock (${muestra}). Reduce el stock a 0 primero.`)
      return
    }

    for (let i = 0; i < varianteIds.length; i += CHUNK) {
      const { count } = await supabase
        .from('sale_items_v2').select('id', { count: 'exact', head: true })
        .in('variante_id', varianteIds.slice(i, i + CHUNK))
      if (count && count > 0) {
        alert('No se puede eliminar: hay láminas de este álbum con historial de ventas registradas.')
        return
      }
    }

    if (!confirm(`¿Eliminar TODAS las láminas de "${album?.nombre}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('stickers').delete().eq('album_id', Number(selectedAlbum))
    if (error) alert(`No se pudo eliminar: ${error.message}`)
    router.refresh()
  }

  const bulkPreview = useMemo(() => {
    const from = Number(rangeFrom)
    const to = Number(rangeTo)
    if (!rangeTo || from > to) return null
    const total = to - from + 1
    const yaExisten = Array.from({ length: total }, (_, i) => from + i)
      .filter((n) => existingNumbers.has(numeroRango(n))).length
    return { total, nuevas: total - yaExisten, yaExisten, primera: numeroRango(from), ultima: numeroRango(to) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFrom, rangeTo, numeroPrefix, existingNumbers])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/collections" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Láminas</h1>
          <p className="text-gray-500 mt-0.5">Registra los números de láminas por álbum</p>
        </div>
      </div>

      {/* Selector de álbum */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <Label className="text-sm font-semibold text-gray-700 mb-2 block">Seleccionar álbum</Label>
        <Select value={selectedAlbum} onValueChange={setSelectedAlbum}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Elige un álbum..." />
          </SelectTrigger>
          <SelectContent>
            {albums.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.collection_types?.nombre} — {a.nombre} {a.anio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {album && (
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Layers className="h-4 w-4 text-blue-400" />
              <strong className="text-gray-800">{albumStickers.length}</strong> láminas registradas
              {album.total_laminas > 0 && ` de ${album.total_laminas}`}
            </span>
            {albumStickers.length > 0 && (
              <button onClick={handleDeleteAll} className="text-red-400 hover:text-red-600 text-xs underline">
                Eliminar todas
              </button>
            )}
          </div>
        )}
      </div>

      {selectedAlbum && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Carga masiva */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListPlus className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-gray-800">Carga masiva por rango</h2>
            </div>
            <form onSubmit={handleBulk} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Desde número</Label>
                  <Input type="number" min="1" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Hasta número</Label>
                  <Input type="number" min="1" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prefijo de número (opcional)</Label>
                  <Input
                    placeholder="Ej: U"
                    value={numeroPrefix}
                    onChange={(e) => setNumeroPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prefijo de descripción (opcional)</Label>
                  <Input placeholder="Ej: Jugador, Escudo..." value={rangePrefix} onChange={(e) => setRangePrefix(e.target.value)} />
                </div>
              </div>
              {esMundial(album) && (
                <button
                  type="button"
                  onClick={() => { setNumeroPrefix('U'); setRangePrefix('Actualización'); setRangeFrom('1') }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Usar para set de actualización (U1, U2… · &quot;Actualización N&quot;)
                </button>
              )}

              {bulkPreview && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm space-y-0.5">
                  <p className="text-blue-800 font-medium">Vista previa</p>
                  <p className="text-blue-700">
                    Total en rango: <strong>{bulkPreview.total}</strong> (#{bulkPreview.primera} – #{bulkPreview.ultima})
                  </p>
                  <p className="text-green-700">Se crearán: <strong>{bulkPreview.nuevas}</strong> láminas nuevas</p>
                  {bulkPreview.yaExisten > 0 && (
                    <p className="text-orange-600">Ya existentes (se omiten): <strong>{bulkPreview.yaExisten}</strong></p>
                  )}
                </div>
              )}

              <Button type="submit" disabled={loadingBulk || !rangeTo} className="w-full">
                {loadingBulk ? 'Creando láminas...' : 'Crear rango'}
              </Button>
            </form>
          </div>

          {/* Individual */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-green-500" />
              <h2 className="font-semibold text-gray-800">Agregar lámina individual</h2>
            </div>
            <form onSubmit={handleSingle} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Número de lámina</Label>
                <Input
                  type="text"
                  placeholder="Ej: 245, 00, 000, A, B, C"
                  value={singleNumero}
                  onChange={(e) => setSingleNumero(e.target.value.toUpperCase())}
                  required
                />
                {singleNumero && existingNumbers.has(singleNumero.trim().toUpperCase()) && (
                  <p className="text-xs text-red-500">Esta lámina ya existe en el álbum</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Input placeholder="Ej: Messi — Argentina" value={singleDesc} onChange={(e) => setSingleDesc(e.target.value)} />
              </div>
              <Button
                type="submit"
                disabled={loadingSingle || !singleNumero || existingNumbers.has(singleNumero.trim().toUpperCase())}
                className="w-full"
                variant="outline"
              >
                {loadingSingle ? 'Agregando...' : 'Agregar lámina'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de láminas registradas */}
      {selectedAlbum && albumStickers.length > 0 && (
        <StickersTable stickers={albumStickers} onSelect={openEdit} />
      )}

      {/* Editar lámina */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar lámina</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEdit} className="space-y-3">
              {editing.imagen_url ? (
                <div className="relative w-32 mx-auto aspect-square rounded overflow-hidden bg-gray-100">
                  <Image src={editing.imagen_url} alt={editing.descripcion ?? `#${editing.numero}`} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  Sin imagen. Las imágenes se cargan desde Inventario → Láminas sueltas.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Número de lámina</Label>
                <Input
                  value={editNumero}
                  onChange={(e) => setEditNumero(e.target.value.toUpperCase())}
                  required
                />
                {editNumeroDuplicado && (
                  <p className="text-xs text-red-500">Ya existe otra lámina con ese número en el álbum</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(editing.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
                <Button type="submit" className="flex-1" disabled={loadingEdit || !editNumero.trim() || editNumeroDuplicado}>
                  {loadingEdit ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Estado vacío */}
      {!selectedAlbum && (
        <div className="text-center py-16 text-gray-400">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona un álbum para gestionar sus láminas</p>
        </div>
      )}
    </div>
  )
}

function StickersTable({ stickers, onSelect }: { stickers: any[]; onSelect: (s: any) => void }) {
  const sorted = [...stickers].sort((a, b) =>
    String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true })
  )

  const groups = sorted.reduce((acc: Record<string, any[]>, s) => {
    // Agrupa por prefijo de descripción; si no hay, por prefijo de número
    // (ej. U1..U20 del set de actualización -> "Serie U").
    const serie = String(s.numero).match(/^([A-Za-z]+)\d+$/)?.[1]?.toUpperCase()
    const prefix = s.descripcion
      ? s.descripcion.replace(/\s*\d+$/, '').trim() || 'Sin descripción'
      : serie ? `Serie ${serie}` : 'Sin descripción'
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(s)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Láminas registradas — {stickers.length} en total
      </p>
      <div className="space-y-6">
        {Object.entries(groups).map(([prefix, items]) => (
          <div key={prefix}>
            <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <span className="bg-gray-100 rounded px-2 py-0.5">{prefix}</span>
              <span className="text-gray-400 font-normal">{items.length} láminas · #{items[0].numero} – #{items[items.length - 1].numero}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {items.map((s) => {
                const img = s.imagen_url
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    title="Click para editar"
                    className="group flex flex-col items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1.5 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    {img ? (
                      <div className="relative w-full aspect-square rounded overflow-hidden bg-gray-100">
                        <Image src={img} alt={s.descripcion ?? `#${s.numero}`} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600 leading-tight text-center">
                      {s.descripcion ?? `#${s.numero}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">Click en una lámina para editarla o eliminarla</p>
    </div>
  )
}
