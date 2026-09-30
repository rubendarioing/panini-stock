export type UserRole = 'admin' | 'staff'

export interface Profile {
  id: string
  email: string
  nombre: string
  rol: UserRole
  activo: boolean
  created_at: string
}

export interface CollectionType {
  id: number
  nombre: string
}

export interface Album {
  id: number
  type_id: number
  nombre: string
  anio: number
  edicion: string | null
  imagen_url: string | null
  total_laminas: number
  activo: boolean
  collection_types?: CollectionType
}

export interface Sticker {
  id: number
  album_id: number
  numero: string
  descripcion: string | null
  categoria: string | null
  albums?: Album
}

export interface Combo {
  id: number
  nombre: string
  descripcion: string | null
  precio_total: number
  activo: boolean
  creado_por: string
}

export interface Sale {
  id: number
  cliente_nombre: string | null
  cliente_contacto: string | null
  total: number
  metodo_pago: 'efectivo' | 'transferencia' | 'otro'
  fecha: string
  usuario_id: string
  notas: string | null
  profiles?: Profile
}

// ---------------------------------------------------------------------------
// Modelo unificado producto/variante/inventario (ver supabase/migrations/011..030).
// Las tablas legacy de stock/ventas/combos se eliminaron en 030.
// ---------------------------------------------------------------------------

export interface Categoria {
  id: number
  nombre: string
  slug: string | null
  descripcion: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Producto {
  id: number
  categoria_id: number
  type_id: number | null
  anio: number | null
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  activo: boolean
  album_id: number | null
  legacy_table: string | null
  legacy_id: number | null
  categorias?: Categoria
  collection_types?: CollectionType
}

export interface ProductoVariante {
  id: number
  producto_id: number
  sku: string | null
  nombre_variante: string | null
  condicion: string | null
  estado: string | null
  es_repetida: boolean | null
  unidades_contenidas: number | null
  precio_compra: number | null
  precio_venta: number | null
  imagen_url: string | null
  notas: string | null
  fecha_compra: string | null
  usuario_id: string | null
  activo: boolean
  legacy_table: string | null
  legacy_id: number | null
  productos?: Producto
  inventario?: Inventario
  producto_variante_imagenes?: ProductoVarianteImagen[]
}

export interface Inventario {
  id: number
  variante_id: number
  cantidad: number
  updated_at: string
}

export interface ProductoVarianteImagen {
  id: number
  variante_id: number
  url: string
  orden: number
}

export interface ComboComponente {
  id: number
  combo_id: number
  variante_id: number
  cantidad: number
  producto_variantes?: ProductoVariante & { productos?: Producto }
}

export interface SaleItemV2 {
  id: number
  sale_id: number
  variante_id: number
  cantidad: number
  precio_unitario: number
  costo_unitario: number | null
  subtotal: number
  producto_variantes?: ProductoVariante & { productos?: Producto }
}
