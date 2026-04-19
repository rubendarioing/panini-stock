'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ShoppingCart, X, Plus, Minus, BookOpen, Layers, Package2, Search, CheckCircle, Upload, ChevronLeft, ChevronRight, Images, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CartItem {
  tipo: 'album' | 'sticker' | 'combo'
  referencia_id: number
  label: string
  sublabel?: string
  imagen_url?: string | null
  precio: number
  cantidad: number
  stock_disponible: number
}

export default function StoreClient({ albumStock, stickerStock, combos, collectionTypes, accesorioStock, stockImagenes }: {
  albumStock: any[]
  stickerStock: any[]
  combos: any[]
  collectionTypes: any[]
  accesorioStock: any[]
  stockImagenes: any[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderDone, setOrderDone] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<{images: string[], idx: number} | null>(null)
  const [comprobante, setComprobante] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customer, setCustomer] = useState({
    nombre: '', email: '', telefono: '', ciudad: '', direccion: '', notas: '',
  })

  // Estado local inicializado desde props del servidor
  const [liveAlbumStock, setLiveAlbumStock]         = useState(albumStock)
  const [liveStickerStock, setLiveStickerStock]     = useState(stickerStock)
  const [liveAccesorioStock, setLiveAccesorioStock] = useState(accesorioStock)
  const [liveCombos, setLiveCombos]                 = useState(combos)
  const [realtimeToast, setRealtimeToast]           = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Sincronizar props del servidor al estado local (se activa tras router.refresh())
  useEffect(() => { setLiveAlbumStock(albumStock) }, [albumStock])
  useEffect(() => { setLiveStickerStock(stickerStock) }, [stickerStock])
  useEffect(() => { setLiveAccesorioStock(accesorioStock) }, [accesorioStock])
  useEffect(() => { setLiveCombos(combos) }, [combos])

  useEffect(() => {
    function showToast() {
      setRealtimeToast(true)
      setTimeout(() => setRealtimeToast(false), 3000)
    }

    // Si el item ya está en estado → actualización directa (rápido, sin red extra)
    // Si no está (era cantidad 0 o es nuevo) → router.refresh() recarga los datos
    // del server component con permisos completos, y los useEffect de sync lo aplican
    function handleStockUpdate(
      row: any,
      setter: React.Dispatch<React.SetStateAction<any[]>>,
      tipo: string,
    ) {
      if (row.cantidad <= 0) {
        setter(prev => prev.filter((s: any) => s.id !== row.id))
        return
      }
      // Leer estado actual sin mutar para decidir si el item existe
      let found = false
      setter(prev => {
        const idx = prev.findIndex((s: any) => s.id === row.id)
        if (idx < 0) return prev
        found = true
        const updated = [...prev]
        updated[idx] = { ...updated[idx], cantidad: row.cantidad, precio_venta: row.precio_venta }
        return updated
      })
      if (!found) router.refresh()
      setCart(prev => prev.map(i =>
        i.tipo === tipo && i.referencia_id === row.id
          ? { ...i, stock_disponible: row.cantidad }
          : i
      ))
    }

    const channel = supabase
      .channel('store-stock')
      // Albums
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_albums' }, ({ new: row }) => {
        if (row.cantidad > 0) router.refresh()
        showToast()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_albums' }, ({ new: row }) => {
        handleStockUpdate(row, setLiveAlbumStock, 'album')
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stock_albums' }, ({ old: row }) => {
        setLiveAlbumStock(prev => prev.filter((s: any) => s.id !== row.id)); showToast()
      })
      // Stickers
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_stickers' }, ({ new: row }) => {
        if (row.cantidad > 0) router.refresh()
        showToast()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_stickers' }, ({ new: row }) => {
        handleStockUpdate(row, setLiveStickerStock, 'sticker')
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stock_stickers' }, ({ old: row }) => {
        setLiveStickerStock(prev => prev.filter((s: any) => s.id !== row.id)); showToast()
      })
      // Accesorios
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_accesorios' }, ({ new: row }) => {
        if (row.cantidad > 0) router.refresh()
        showToast()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_accesorios' }, ({ new: row }) => {
        handleStockUpdate(row, setLiveAccesorioStock, 'accesorio')
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stock_accesorios' }, ({ old: row }) => {
        setLiveAccesorioStock(prev => prev.filter((s: any) => s.id !== row.id)); showToast()
      })
      // Combos
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combos' }, ({ new: row }) => {
        if (!row.activo) {
          setLiveCombos(prev => prev.filter((c: any) => c.id !== row.id))
        } else {
          setLiveCombos(prev => prev.map((c: any) =>
            c.id === row.id ? { ...c, precio_total: row.precio_total, nombre: row.nombre, descripcion: row.descripcion } : c
          ))
        }
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'combos' }, ({ old: row }) => {
        setLiveCombos(prev => prev.filter((c: any) => c.id !== row.id)); showToast()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imagenesMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    stockImagenes.forEach((img: any) => {
      const key = `${img.tabla}-${img.referencia_id}`
      if (!map[key]) map[key] = []
      map[key].push(img.url)
    })
    return map
  }, [stockImagenes])

  const products = useMemo(() => {
    const list: any[] = []

    liveAlbumStock.forEach((s: any) => {
      const badge = s.estado === 'lleno' ? 'Lleno' : s.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío'
      const badgeVariant = s.estado === 'lleno' ? 'success' : s.estado === 'set_a_pegar' ? 'warning' : 'secondary'
      const imgs = imagenesMap[`stock_albums-${s.id}`] ?? []
      const mainImg = imgs[0] ?? s.imagen_url ?? s.albums?.imagen_url ?? null
      list.push({
        id: `album-${s.id}`,
        tipo: 'album',
        referencia_id: s.id,
        label: s.albums?.nombre ?? 'Álbum',
        sublabel: `${s.albums?.collection_types?.nombre ?? ''} ${s.albums?.anio ?? ''}`.trim(),
        categoria: s.albums?.collection_types?.nombre ?? 'Otros',
        type_id: s.albums?.type_id,
        imagen_url: mainImg,
        imagenes: imgs.length > 0 ? imgs : (mainImg ? [mainImg] : []),
        notas: s.notas ?? '',
        precio: s.precio_venta,
        stock: s.cantidad,
        badge,
        badgeVariant,
      })
    })

    liveAccesorioStock.forEach((s: any) => {
      const esSobre = s.tipo === 'sobre'
      const badge = s.cantidad_contenido
        ? `${esSobre ? 'Sobre' : 'Caja'} · ${s.cantidad_contenido} ${esSobre ? 'láminas' : 'sobres'}`
        : esSobre ? 'Sobre' : 'Caja Sellada'
      const imgs = imagenesMap[`stock_accesorios-${s.id}`] ?? []
      const mainImg = imgs[0] ?? s.imagen_url ?? s.albums?.imagen_url ?? null
      list.push({
        id: `accesorio-${s.id}`,
        tipo: 'accesorio',
        referencia_id: s.id,
        label: s.albums?.nombre ?? 'Accesorio',
        sublabel: `${esSobre ? 'Sobre' : 'Caja Sellada'} — ${s.albums?.collection_types?.nombre ?? ''} ${s.albums?.anio ?? ''}`.trim(),
        categoria: esSobre ? 'Sobres' : 'Cajas Selladas',
        type_id: null,
        imagen_url: mainImg,
        imagenes: imgs.length > 0 ? imgs : (mainImg ? [mainImg] : []),
        notas: s.notas ?? '',
        precio: s.precio_venta,
        stock: s.cantidad,
        badge,
        badgeVariant: esSobre ? 'secondary' : 'warning',
      })
    })

    liveStickerStock.forEach((s: any) => {
      const imgs = imagenesMap[`stock_stickers-${s.id}`] ?? []
      const mainImg = imgs[0] ?? s.imagen_url ?? null
      list.push({
        id: `sticker-${s.id}`,
        tipo: 'sticker',
        referencia_id: s.id,
        label: `Lámina #${s.stickers?.numero}`,
        sublabel: `${s.stickers?.albums?.nombre ?? ''} — ${s.stickers?.albums?.collection_types?.nombre ?? ''} ${s.stickers?.albums?.anio ?? ''}`.trim(),
        categoria: 'Láminas',
        type_id: null,
        imagen_url: mainImg,
        imagenes: imgs.length > 0 ? imgs : (mainImg ? [mainImg] : []),
        descripcion: s.stickers?.descripcion ?? '',
        notas: s.notas ?? '',
        precio: s.precio_venta,
        stock: s.cantidad,
        badge: s.es_repetida ? 'Repetida' : 'Normal',
        badgeVariant: s.es_repetida ? 'warning' : 'secondary',
      })
    })

    liveCombos.forEach((c: any) => {
      list.push({
        id: `combo-${c.id}`,
        tipo: 'combo',
        referencia_id: c.id,
        label: c.nombre,
        sublabel: c.descripcion,
        categoria: 'Combos',
        type_id: null,
        imagen_url: c.imagen_url ?? null,
        imagenes: c.imagen_url ? [c.imagen_url] : [],
        precio: c.precio_total,
        stock: 999,
        badge: 'Combo',
        badgeVariant: 'default',
      })
    })

    return list
  }, [liveAlbumStock, liveStickerStock, liveAccesorioStock, liveCombos, imagenesMap])

  const categories = [
    { value: 'all', label: 'Todo' },
    ...collectionTypes.map((t: any) => ({ value: t.nombre, label: t.nombre })),
    { value: 'Sobres', label: 'Sobres' },
    { value: 'Cajas Selladas', label: 'Cajas Selladas' },
    { value: 'Láminas', label: 'Láminas' },
    { value: 'Combos', label: 'Combos' },
  ]



  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = search === '' ||
      p.label.toLowerCase().includes(q) ||
      p.sublabel?.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q) ||
      p.notas?.toLowerCase().includes(q)
    const matchCategory = filterCategory === 'all' || p.categoria === filterCategory
    return matchSearch && matchCategory
  })

  function addToCart(product: any) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.tipo === product.tipo && i.referencia_id === product.referencia_id)
      if (idx >= 0) {
        const updated = [...prev]
        if (updated[idx].cantidad < product.stock) {
          updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 }
        }
        return updated
      }
      return [...prev, {
        tipo: product.tipo,
        referencia_id: product.referencia_id,
        label: product.label,
        sublabel: product.sublabel,
        imagen_url: product.imagen_url,
        precio: product.precio,
        cantidad: 1,
        stock_disponible: product.stock,
      }]
    })
  }

  function updateQty(idx: number, delta: number) {
    setCart((prev) => {
      const updated = [...prev]
      const newQty = updated[idx].cantidad + delta
      if (newQty <= 0) return prev.filter((_, i) => i !== idx)
      if (newQty > updated[idx].stock_disponible) return prev
      updated[idx] = { ...updated[idx], cantidad: newQty }
      return updated
    })
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  const cartTotal = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
  const cartCount = cart.reduce((acc, i) => acc + i.cantidad, 0)

  const telefonoValido = /^\d{10}$/.test(customer.telefono.trim())
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())

  const formValido =
    customer.nombre.trim() !== '' &&
    telefonoValido &&
    emailValido &&
    customer.ciudad.trim() !== '' &&
    customer.direccion.trim() !== '' &&
    customer.notas.trim() !== '' &&
    comprobante !== null

  function getCartQty(tipo: string, refId: number) {
    return cart.find((i) => i.tipo === tipo && i.referencia_id === refId)?.cantidad ?? 0
  }

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return
    setLoading(true)
    setOrderError(null)

    const fd = new FormData()
    fd.append('nombre', customer.nombre)
    fd.append('email', customer.email)
    fd.append('telefono', customer.telefono)
    fd.append('ciudad', customer.ciudad)
    fd.append('direccion', customer.direccion)
    fd.append('notas', customer.notas)
    fd.append('total', String(cartTotal))
    fd.append('items', JSON.stringify(cart.map((i) => ({
      tipo: i.tipo,
      referencia_id: i.referencia_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
      subtotal: i.precio * i.cantidad,
    }))))
    if (comprobante) fd.append('comprobante', comprobante)

    const res = await fetch('/api/store/order', { method: 'POST', body: fd })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setOrderNumber(data.order_id)
      setCart([])
      setCheckoutOpen(false)
      setOrderDone(true)
    } else {
      setOrderError(data.error ?? 'Ocurrió un error al registrar el pedido. Intenta de nuevo.')
    }
  }

  if (orderDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Pedido registrado!</h2>
        <p className="text-gray-500 mb-1">Tu número de pedido es:</p>
        <p className="text-3xl font-bold text-[#003DA5] mb-4">#{orderNumber}</p>
        <p className="text-gray-500 max-w-sm mb-8">
          Nos pondremos en contacto contigo pronto para coordinar la entrega.
        </p>
        <button
          onClick={() => {
            setOrderDone(false)
            setCustomer({ nombre: '', email: '', telefono: '', ciudad: '', direccion: '', notas: '' })
            setComprobante(null)
          }}
          className="bg-[#003DA5] hover:bg-[#002d80] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Seguir comprando
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Título */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Catálogo</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Álbumes, láminas y combos de tus torneos favoritos</p>
      </div>

      {/* Buscador */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtros — scroll horizontal en móvil */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-5">
        <div className="flex gap-2 pb-1 sm:flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                filterCategory === cat.value
                  ? 'bg-[#003DA5] text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#003DA5] hover:text-[#003DA5]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de productos */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => {
            const inCart = getCartQty(product.tipo, product.referencia_id)
            return (
              <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col active:scale-[0.98] hover:shadow-md hover:border-blue-200 transition-all">
                <div
                  className={`relative bg-gray-100 aspect-[3/4] ${product.imagenes?.length > 0 ? 'cursor-zoom-in' : ''}`}
                  onClick={product.imagenes?.length > 0 ? () => setGallery({ images: product.imagenes, idx: 0 }) : undefined}
                >
                  {product.imagen_url ? (
                    <Image src={product.imagen_url} alt={product.label} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                      {product.tipo === 'album' && <BookOpen className="h-8 w-8 sm:h-10 sm:w-10" />}
                      {product.tipo === 'sticker' && <Layers className="h-8 w-8 sm:h-10 sm:w-10" />}
                      {(product.tipo === 'combo' || product.tipo === 'accesorio') && <Package2 className="h-8 w-8 sm:h-10 sm:w-10" />}
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
                    <Badge variant={product.badgeVariant as any} className="text-[10px] sm:text-xs px-1.5">{product.badge}</Badge>
                  </div>
                  {product.stock < 5 && product.stock < 999 && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                      <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5">¡Últimas!</Badge>
                    </div>
                  )}
                  {product.imagenes?.length > 1 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <Images className="h-2.5 w-2.5" />
                      <span className="text-[9px] font-medium">{product.imagenes.length}</span>
                    </div>
                  )}
                </div>
                <div className="p-2 sm:p-3 flex flex-col flex-1">
                  <p className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight line-clamp-2">{product.label}</p>
                  {product.sublabel && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">{product.sublabel}</p>}
                  {product.notas && <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2">{product.notas}</p>}
                  <div className="mt-auto pt-2">
                    <p className="text-base sm:text-lg font-bold text-[#003DA5]">{formatCurrency(product.precio)}</p>
                    {product.stock < 999 && <p className="text-[10px] sm:text-xs text-gray-400">{product.stock} disp.</p>}
                    {inCart === 0 ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-2 w-full bg-[#003DA5] active:bg-[#002d80] hover:bg-[#002d80] text-white text-xs sm:text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline sm:inline">Agregar</span>
                        <span className="xs:hidden sm:hidden">+</span>
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-1 py-1.5 sm:px-2">
                        <button
                          onClick={() => {
                            const idx = cart.findIndex(i => i.tipo === product.tipo && i.referencia_id === product.referencia_id)
                            updateQty(idx, -1)
                          }}
                          className="p-1.5 text-[#003DA5] active:bg-blue-100 hover:bg-blue-100 rounded"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[#003DA5] font-bold text-sm">{inCart}</span>
                        <button onClick={() => addToCart(product)} className="p-1.5 text-[#003DA5] active:bg-blue-100 hover:bg-blue-100 rounded">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Botón flotante carrito */}
      {cartCount > 0 && !cartOpen && !checkoutOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-[#003DA5] active:bg-[#002d80] hover:bg-[#002d80] text-white rounded-full shadow-lg flex items-center gap-2 transition-all z-50 px-4 py-3 sm:px-5"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          </div>
          <span className="font-bold text-sm">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Panel carrito lateral */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-sm flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b bg-[#003DA5] text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Tu carrito
              </h2>
              <button onClick={() => setCartOpen(false)} className="p-1 text-blue-200 hover:text-white rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>El carrito está vacío</p>
                </div>
              ) : cart.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {item.imagen_url ? (
                    <div className="relative h-14 w-10 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                      <Image src={item.imagen_url} alt={item.label} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="h-14 w-10 flex-shrink-0 rounded bg-gray-200 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.label}</p>
                    <p className="text-xs text-gray-400 line-clamp-1">{item.sublabel}</p>
                    <p className="text-sm font-bold text-[#003DA5] mt-1">{formatCurrency(item.precio * item.cantidad)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={() => updateQty(idx, 1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Plus className="h-3.5 w-3.5" /></button>
                    <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                    <button onClick={() => updateQty(idx, -1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Minus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded self-start">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t p-4 space-y-3 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                <span className="text-xl font-bold text-[#003DA5]">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                className="w-full bg-[#003DA5] hover:bg-[#002d80] text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Finalizar pedido
              </button>
              <button onClick={() => setCartOpen(false)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
                Seguir comprando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de actualización en tiempo real */}
      {realtimeToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-fade-in">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Catálogo actualizado
        </div>
      )}

      {/* Lightbox galería de imágenes */}
      {gallery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setGallery(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setGallery(null) }}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
          >
            <X className="h-6 w-6" />
          </button>
          {gallery.images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setGallery(g => g ? { ...g, idx: (g.idx - 1 + g.images.length) % g.images.length } : null) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 bg-black/30 rounded-full"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}
          <div className="relative max-w-[90vw] max-h-[85vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Image
              src={gallery.images[gallery.idx]}
              alt={`Imagen ${gallery.idx + 1}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          {gallery.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setGallery(g => g ? { ...g, idx: (g.idx + 1) % g.images.length } : null) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 bg-black/30 rounded-full"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {gallery.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setGallery(g => g ? { ...g, idx: i } : null) }}
                    className={`w-2 h-2 rounded-full transition-colors ${i === gallery.idx ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal checkout */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCheckoutOpen(false)} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-lg h-[95dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between p-5 border-b bg-[#003DA5] rounded-t-2xl text-white flex-shrink-0">
              <h2 className="text-xl font-bold">Confirmar pedido</h2>
              <button onClick={() => setCheckoutOpen(false)} className="p-1 text-blue-200 hover:text-white rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Resumen */}
            <div className="px-5 py-3 bg-blue-50 border-b max-h-36 overflow-y-auto flex-shrink-0">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-gray-700">{item.cantidad}× {item.label}</span>
                  <span className="font-semibold text-[#003DA5]">{formatCurrency(item.precio * item.cantidad)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-2 border-t mt-1">
                <span>Total</span>
                <span className="text-[#003DA5]">{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            <form onSubmit={handleOrder} className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label>Nombre completo</Label>
                <Input placeholder="Tu nombre" value={customer.nombre} onChange={(e) => setCustomer({ ...customer, nombre: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>WhatsApp / Teléfono</Label>
                  <Input
                    placeholder="Ej: 3001234567"
                    value={customer.telefono}
                    onChange={(e) => { setCustomer({ ...customer, telefono: e.target.value }); setOrderError(null) }}
                    required
                    className={customer.telefono && !telefonoValido ? 'border-red-400 focus-visible:ring-red-300' : ''}
                  />
                  {customer.telefono && !telefonoValido && (
                    <p className="text-xs text-red-500">Debe tener exactamente 10 dígitos numéricos</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Correo electrónico</Label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    required
                    className={customer.email && !emailValido ? 'border-red-400 focus-visible:ring-red-300' : ''}
                  />
                  {customer.email && !emailValido && (
                    <p className="text-xs text-red-500">Ingresa un correo electrónico válido</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad</Label>
                  <Input placeholder="Tu ciudad" value={customer.ciudad} onChange={(e) => setCustomer({ ...customer, ciudad: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección de envío</Label>
                  <Input placeholder="Calle, barrio..." value={customer.direccion} onChange={(e) => setCustomer({ ...customer, direccion: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notas del pedido</Label>
                <Input placeholder="Ej: horario de entrega, indicaciones de acceso..." value={customer.notas} onChange={(e) => setCustomer({ ...customer, notas: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Comprobante de pago</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-[#003DA5] hover:bg-blue-50 transition-colors"
                >
                  {comprobante ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">{comprobante.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Click para adjuntar imagen del pago</span>
                      <span className="text-xs">PNG, JPG hasta 5MB</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setComprobante(e.target.files?.[0] ?? null)} />
              </div>

              {orderError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {orderError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !formValido}
                title={!formValido ? 'Completa todos los campos para continuar' : undefined}
                className="w-full bg-[#003DA5] hover:bg-[#002d80] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-base"
              >
                {loading ? 'Registrando pedido...' : `Confirmar pedido — ${formatCurrency(cartTotal)}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
