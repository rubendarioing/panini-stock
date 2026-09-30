// Construye una etiqueta legible para una fila de producto_variantes, sin
// ramificar por tipo de tabla legacy: toda la información viene de
// productos.categorias.slug (album/lamina/sobre/caja/combo). Reemplaza los
// bloques repetidos por-tipo que existían en checkout, combos y ventas antes
// de la migración al modelo unificado (ver plan_migracion_modelo_panini_supabase.md).

export interface VarianteLabelData {
  estado?: string | null
  es_repetida?: boolean | null
  unidades_contenidas?: number | null
  productos?: {
    nombre?: string | null
    anio?: number | null
    numero?: string | null
    descripcion?: string | null
    categorias?: { slug?: string | null } | null
    collection_types?: { nombre?: string | null } | null
  } | null
}

export function labelForVariante(v: VarianteLabelData | null | undefined): string {
  if (!v) return 'Producto'
  const p = v.productos
  const categoria = p?.categorias?.slug
  const col = p?.collection_types?.nombre ? ` — ${p.collection_types.nombre}` : ''

  if (categoria === 'album') {
    const estadoLabel = v.estado === 'lleno' ? 'Lleno' : v.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío'
    return `Álbum ${p?.nombre ?? ''} ${p?.anio ?? ''}${col} · ${estadoLabel}`
  }
  if (categoria === 'lamina') {
    return `${p?.nombre ?? 'Lámina'}${p?.descripcion ? ` "${p.descripcion}"` : ''}${v.es_repetida ? ' (repetida)' : ''}`
  }
  if (categoria === 'sobre' || categoria === 'caja') {
    const tipoLabel = categoria === 'sobre' ? 'Sobre' : 'Caja Sellada'
    const contenido = v.unidades_contenidas
      ? ` (${v.unidades_contenidas} ${categoria === 'sobre' ? 'láminas' : 'sobres'})`
      : ''
    return `${tipoLabel}${contenido} de ${p?.nombre ?? ''} ${p?.anio ?? ''}${col}`
  }
  if (categoria === 'set_actualizacion') {
    const contenido = v.unidades_contenidas ? ` (${v.unidades_contenidas} láminas)` : ''
    return `Set de actualización${contenido} de ${p?.nombre ?? ''} ${p?.anio ?? ''}${col}`
  }
  if (categoria === 'combo') {
    return `Combo: ${p?.nombre ?? ''}`
  }
  return p?.nombre ?? 'Producto'
}

// Tipos que se gestionan en Inventario → Sobres, cajas y sets: un producto por
// álbum + tipo (productos.album_id + categoria_id).
export const TIPOS_ACCESORIO: Record<string, {
  label: string
  plural: string
  sufijoNombre: string
  contenidoLabel: string
  contenidoUnidad: string
  contenidoPlaceholder: string
  soloMundial?: boolean
}> = {
  sobre: {
    label: 'Sobre', plural: 'sobres', sufijoNombre: 'Sobre',
    contenidoLabel: 'Láminas por sobre', contenidoUnidad: 'láminas', contenidoPlaceholder: 'Ej: 5',
  },
  caja: {
    label: 'Caja Sellada', plural: 'cajas selladas', sufijoNombre: 'Caja',
    contenidoLabel: 'Sobres por caja', contenidoUnidad: 'sobres', contenidoPlaceholder: 'Ej: 36',
  },
  set_actualizacion: {
    label: 'Set de actualización', plural: 'sets de actualización', sufijoNombre: 'Set de actualización',
    contenidoLabel: 'Láminas en el set', contenidoUnidad: 'láminas', contenidoPlaceholder: 'Ej: 20',
    soloMundial: true,
  },
}

// Por ahora solo los Mundiales tienen set de actualización.
export function esMundial(album: { collection_types?: { nombre?: string | null } | null } | null | undefined): boolean {
  return /mundial/i.test(album?.collection_types?.nombre ?? '')
}
