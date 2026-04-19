'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Trash2, Layers, Plus, ListPlus, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function StickersClient({ albums, stickers }: { albums: any[]; stickers: any[] }) {
  const [selectedAlbum, setSelectedAlbum] = useState<string>('')
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [loadingSingle, setLoadingSingle] = useState(false)

  // Carga masiva
  const [rangeFrom, setRangeFrom] = useState('1')
  const [rangeTo, setRangeTo] = useState('')
  const [rangePrefix, setRangePrefix] = useState('')

  // Individual
  const [singleNumero, setSingleNumero] = useState('')
  const [singleDesc, setSingleDesc] = useState('')

  const supabase = createClient()
  const router = useRouter()

  const album = albums.find((a) => String(a.id) === selectedAlbum)

  const albumStickers = useMemo(
    () => stickers.filter((s) => String(s.album_id) === selectedAlbum),
    [stickers, selectedAlbum]
  )

  const existingNumbers = useMemo(
    () => new Set(albumStickers.filter((s) => !s.descripcion).map((s) => String(s.numero))),
    [albumStickers]
  )

  const existingDescriptions = useMemo(
    () => new Set(albumStickers.map((s) => s.descripcion).filter(Boolean)),
    [albumStickers]
  )

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAlbum) return
    const from = Number(rangeFrom)
    const to = Number(rangeTo)
    if (from > to || to - from > 999) return

    setLoadingBulk(true)

    const nuevas = []
    for (let n = from; n <= to; n++) {
      const desc = rangePrefix ? `${rangePrefix} ${n}` : null
      const yaExiste = desc ? existingDescriptions.has(desc) : existingNumbers.has(String(n))
      if (!yaExiste) {
        nuevas.push({
          album_id: Number(selectedAlbum),
          numero: String(n),
          descripcion: desc,
        })
      }
    }

    if (nuevas.length > 0) {
      const CHUNK = 200
      for (let i = 0; i < nuevas.length; i += CHUNK) {
        await supabase.from('stickers').insert(nuevas.slice(i, i + CHUNK))
      }
    }

    setLoadingBulk(false)
    setRangePrefix('')
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
    await supabase.from('stickers').insert({
      album_id: Number(selectedAlbum),
      numero,
      descripcion: singleDesc || null,
    })
    setLoadingSingle(false)
    setSingleNumero('')
    setSingleDesc('')
    router.refresh()
  }

  async function handleDelete(id: number) {
    const { data: activeStock } = await supabase
      .from('stock_stickers').select('id, cantidad').eq('sticker_id', id).gt('cantidad', 0)
    if (activeStock?.length) {
      const total = activeStock.reduce((a: number, s: any) => a + s.cantidad, 0)
      alert(`No se puede eliminar: tiene ${total} unidad(es) en stock. Reduce el stock a 0 primero.`)
      return
    }

    const { data: allStock } = await supabase
      .from('stock_stickers').select('id').eq('sticker_id', id)
    if (allStock?.length) {
      const ids = allStock.map((s: any) => s.id)
      const { count } = await supabase
        .from('sale_items').select('id', { count: 'exact', head: true })
        .eq('tipo', 'sticker').in('referencia_id', ids)
      if (count && count > 0) {
        alert('No se puede eliminar: la lámina tiene historial de ventas registradas.')
        return
      }
    }

    if (!confirm('¿Eliminar esta lámina del catálogo?')) return
    if (allStock?.length) await supabase.from('stock_stickers').delete().eq('sticker_id', id)
    await supabase.from('stickers').delete().eq('id', id)
    router.refresh()
  }

  async function handleDeleteAll() {
    if (!selectedAlbum) return
    if (!confirm(`¿Eliminar TODAS las láminas de "${album?.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('stickers').delete().eq('album_id', Number(selectedAlbum))
    router.refresh()
  }

  const bulkPreview = useMemo(() => {
    const from = Number(rangeFrom)
    const to = Number(rangeTo)
    if (!rangeTo || from > to) return null
    const total = to - from + 1
    const yaExisten = Array.from({ length: total }, (_, i) => from + i).filter((n) => {
      const desc = rangePrefix ? `${rangePrefix} ${n}` : null
      return desc ? existingDescriptions.has(desc) : existingNumbers.has(String(n))
    }).length
    return { total, nuevas: total - yaExisten, yaExisten }
  }, [rangeFrom, rangeTo, rangePrefix, existingNumbers, existingDescriptions])

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
              <div className="space-y-1.5">
                <Label>Prefijo de descripción (opcional)</Label>
                <Input placeholder="Ej: Jugador, Escudo..." value={rangePrefix} onChange={(e) => setRangePrefix(e.target.value)} />
              </div>

              {bulkPreview && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm space-y-0.5">
                  <p className="text-blue-800 font-medium">Vista previa</p>
                  <p className="text-blue-700">Total en rango: <strong>{bulkPreview.total}</strong></p>
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
        <StickersTable stickers={albumStickers} onDelete={handleDelete} />
      )}

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

function getImagen(s: any): string | null {
  const entries: any[] = s.stock_stickers ?? []
  return entries.find((e) => e.imagen_url)?.imagen_url ?? null
}

function StickersTable({ stickers, onDelete }: { stickers: any[]; onDelete: (id: number) => void }) {
  const sorted = [...stickers].sort((a, b) =>
    String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true })
  )

  const groups = sorted.reduce((acc: Record<string, any[]>, s) => {
    const prefix = s.descripcion
      ? s.descripcion.replace(/\s*\d+$/, '').trim() || 'Sin descripción'
      : 'Sin descripción'
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
                const img = getImagen(s)
                return (
                  <button
                    key={s.id}
                    onClick={() => onDelete(s.id)}
                    title="Click para eliminar"
                    className="group flex flex-col items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1.5 hover:bg-red-50 hover:border-red-300 transition-colors"
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
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-red-600 leading-tight text-center">
                      {s.descripcion ?? `#${s.numero}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">Click en una lámina para eliminarla</p>
    </div>
  )
}
