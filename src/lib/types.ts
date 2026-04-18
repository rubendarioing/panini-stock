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

export interface Collection {
  id: number
  type_id: number
  nombre: string
  anio: number
  descripcion: string | null
  imagen_url: string | null
  activo: boolean
  collection_types?: CollectionType
}

export interface Album {
  id: number
  collection_id: number
  nombre: string
  edicion: string | null
  total_laminas: number
  collections?: Collection
}

export interface Sticker {
  id: number
  album_id: number
  numero: string
  descripcion: string | null
  categoria: string | null
  albums?: Album
}

export interface StockAlbum {
  id: number
  album_id: number
  cantidad: number
  precio_compra: number
  precio_venta: number
  fecha_compra: string
  condicion: 'nuevo' | 'usado' | 'sellado'
  usuario_id: string
  notas: string | null
  albums?: Album & { collections?: Collection }
}

export interface StockSticker {
  id: number
  sticker_id: number
  cantidad: number
  precio_compra: number
  precio_venta: number
  fecha_compra: string
  es_repetida: boolean
  usuario_id: string
  notas: string | null
  stickers?: Sticker & { albums?: Album & { collections?: Collection } }
}

export interface Combo {
  id: number
  nombre: string
  descripcion: string | null
  precio_total: number
  activo: boolean
  creado_por: string
  combo_items?: ComboItem[]
}

export interface ComboItem {
  id: number
  combo_id: number
  tipo: 'album' | 'sticker'
  stock_album_id: number | null
  stock_sticker_id: number | null
  cantidad: number
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
  sale_items?: SaleItem[]
  profiles?: Profile
}

export interface SaleItem {
  id: number
  sale_id: number
  tipo: 'album' | 'sticker' | 'combo'
  referencia_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
}
