import { createClient } from '@/lib/supabase/server'
import StickersClient from './StickersClient'

export default async function StickersCatalogPage() {
  const supabase = await createClient()

  const [{ data: albums }, { data: stickers }, { data: productos }] = await Promise.all([
    supabase
      .from('albums')
      .select('id, nombre, anio, total_laminas, collection_types(nombre)')
      .eq('activo', true)
      .order('anio', { ascending: false }),
    supabase
      .from('stickers')
      .select('id, numero, descripcion, categoria, album_id')
      .order('album_id')
      .order('numero'),
    // Las imágenes viven en el modelo unificado (las sube "Láminas sueltas"):
    // producto_variante_imagenes / producto_variantes.imagen_url.
    supabase
      .from('productos')
      .select('legacy_id, imagen_url, producto_variantes(imagen_url, producto_variante_imagenes(url, orden))')
      .eq('legacy_table', 'stickers'),
  ])

  const imagenPorSticker = new Map<number, string>()
  for (const p of productos ?? []) {
    const variantes: any[] = p.producto_variantes ?? []
    const galeria = variantes
      .flatMap((v) => v.producto_variante_imagenes ?? [])
      .sort((a: any, b: any) => a.orden - b.orden)
    const url = galeria[0]?.url ?? variantes.find((v) => v.imagen_url)?.imagen_url ?? p.imagen_url
    if (url) imagenPorSticker.set(p.legacy_id, url)
  }

  const stickersConImagen = (stickers ?? []).map((s) => ({
    ...s,
    imagen_url: imagenPorSticker.get(s.id) ?? null,
  }))

  return <StickersClient albums={albums ?? []} stickers={stickersConImagen} />
}
