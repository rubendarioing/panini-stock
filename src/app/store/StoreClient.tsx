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
import { labelForVariante } from '@/lib/product-labels'

interface CartItem {
  variante_id: number
  categoria_slug: string
  label: string
  sublabel?: string
  imagen_url?: string | null
  precio: number
  cantidad: number
  stock_disponible: number
}

export default function StoreClient({ variantes, collectionTypes, varianteImagenes, comboComponentes }: {
  variantes: any[]
  collectionTypes: any[]
  varianteImagenes: any[]
  comboComponentes: any[]
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
  const [customer, setCustomer] = useState({
    nombre: '', email: '', telefono: '', ciudad: '', direccion: '', notas: '',
  })

  // Estado local inicializado desde props del servidor
  const [liveVariantes, setLiveVariantes] = useState(variantes)
  const [realtimeToast, setRealtimeToast]   = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Sincronizar props del servidor al estado local (se activa tras router.refresh())
  useEffect(() => { setLiveVariantes(variantes) }, [variantes])

  useEffect(() => {
    function showToast() {
      setRealtimeToast(true)
      setTimeout(() => setRealtimeToast(false), 3000)
    }

    const channel = supabase
      .channel('store-stock')
      // Inventario: única fuente de cambios de cantidad para todos los productos,
      // combos incluidos (tienen stock propio, ver 031_combos_stock_reservado.sql).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventario' }, ({ new: row }) => {
        if (row.cantidad > 0) router.refresh()
        showToast()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventario' }, ({ new: row }) => {
        let found = false
        setLiveVariantes(prev => {
          const idx = prev.findIndex((v: any) => v.id === row.variante_id)
          if (idx < 0) return prev
          found = true
          if (row.cantidad <= 0) return prev.filter((v: any) => v.id !== row.variante_id)
          const updated = [...prev]
          updated[idx] = { ...updated[idx], cantidad: row.cantidad }
          return updated
        })
        if (!found && row.cantidad > 0) router.refresh()
        setCart(prev => prev.map(i =>
          i.variante_id === row.variante_id ? { ...i, stock_disponible: row.cantidad } : i
        ))
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventario' }, ({ old: row }) => {
        setLiveVariantes(prev => prev.filter((v: any) => v.id !== row.variante_id)); showToast()
      })
      // Combos: precio/activo se editan directo en la tabla `combos`.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combos' }, ({ new: row }) => {
        setLiveVariantes(prev => {
          if (!row.activo) return prev.filter((v: any) => !(v.legacy_table === 'combos' && v.legacy_id === row.id))
          return prev.map((v: any) =>
            v.legacy_table === 'combos' && v.legacy_id === row.id
              ? { ...v, precio_venta: row.precio_total, producto_nombre: row.nombre, producto_descripcion: row.descripcion }
              : v
          )
        })
        showToast()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'combos' }, ({ old: row }) => {
        setLiveVariantes(prev => prev.filter((v: any) => !(v.legacy_table === 'combos' && v.legacy_id === row.id)))
        showToast()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imagenesMap = useMemo(() => {
    const map: Record<number, string[]> = {}
    varianteImagenes.forEach((img: any) => {
      if (!map[img.variante_id]) map[img.variante_id] = []
      map[img.variante_id].push(img.url)
    })
    return map
  }, [varianteImagenes])

  // Ítems de cada combo (v_combo_componentes_publico), por variante del combo.
  const itemsPorCombo = useMemo(() => {
    const map: Record<number, { label: string; notas: string | null }[]> = {}
    for (const c of comboComponentes) {
      const label = labelForVariante({
        estado: c.estado,
        es_repetida: c.es_repetida,
        unidades_contenidas: c.unidades_contenidas,
        productos: {
          nombre: c.producto_nombre,
          anio: c.anio,
          numero: c.producto_numero,
          descripcion: c.producto_descripcion,
          categorias: { slug: c.categoria_slug },
          collection_types: { nombre: c.coleccion_nombre },
        },
      })
      ;(map[c.combo_variante_id] ??= []).push({ label: `${c.cantidad}x ${label}`, notas: c.notas ?? null })
    }
    return map
  }, [comboComponentes])

  const products = useMemo(() => {
    return liveVariantes
      .filter((v: any) => v.activo && v.cantidad > 0)
      .map((v: any) => {
        const imgs = imagenesMap[v.id] ?? []
        const mainImg = imgs[0] ?? v.imagen_url ?? v.producto_imagen_url ?? null
        const stock = v.cantidad

        let label = v.producto_nombre ?? 'Producto'
        let sublabel = [v.coleccion_nombre, v.anio].filter(Boolean).join(' ')
        let categoria = v.categoria_nombre
        let badge = ''
        let badgeVariant: string = 'secondary'

        if (v.categoria_slug === 'album') {
          badge = v.estado === 'lleno' ? 'Lleno' : v.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío'
          badgeVariant = v.estado === 'lleno' ? 'success' : v.estado === 'set_a_pegar' ? 'warning' : 'secondary'
          categoria = v.coleccion_nombre ?? 'Otros'
        } else if (v.categoria_slug === 'sobre' || v.categoria_slug === 'caja') {
          const esSobre = v.categoria_slug === 'sobre'
          badge = v.unidades_contenidas
            ? `${esSobre ? 'Sobre' : 'Caja'} · ${v.unidades_contenidas} ${esSobre ? 'láminas' : 'sobres'}`
            : (esSobre ? 'Sobre' : 'Caja Sellada')
          badgeVariant = esSobre ? 'secondary' : 'warning'
          categoria = esSobre ? 'Sobres' : 'Cajas Selladas'
        } else if (v.categoria_slug === 'lamina') {
          if (v.producto_numero) label = `Lámina #${v.producto_numero}`
          badge = v.es_repetida ? 'Repetida' : 'Normal'
          badgeVariant = v.es_repetida ? 'warning' : 'secondary'
          categoria = 'Láminas'
        } else if (v.categoria_slug === 'combo') {
          badge = 'Combo'
          badgeVariant = 'default'
          categoria = 'Combos'
          sublabel = v.producto_descripcion ?? ''
        }

        return {
          variante_id: v.id,
          categoria_slug: v.categoria_slug,
          label,
          sublabel,
          categoria,
          type_id: v.type_id,
          imagen_url: mainImg,
          imagenes: imgs.length > 0 ? imgs : (mainImg ? [mainImg] : []),
          descripcion: v.categoria_slug === 'lamina' ? (v.producto_descripcion ?? '') : '',
          notas: v.notas ?? '',
          comboItems: v.categoria_slug === 'combo' ? (itemsPorCombo[v.id] ?? []) : [],
          precio: v.precio_venta,
          stock,
          badge,
          badgeVariant,
        }
      })
  }, [liveVariantes, imagenesMap, itemsPorCombo])

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
      p.notas?.toLowerCase().includes(q) ||
      p.comboItems.some((item) => item.label.toLowerCase().includes(q) || item.notas?.toLowerCase().includes(q))
    const matchCategory = filterCategory === 'all' || p.categoria === filterCategory
    return matchSearch && matchCategory
  })

  function addToCart(product: any) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variante_id === product.variante_id)
      if (idx >= 0) {
        const updated = [...prev]
        if (updated[idx].cantidad < product.stock) {
          updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 }
        }
        return updated
      }
      return [...prev, {
        variante_id: product.variante_id,
        categoria_slug: product.categoria_slug,
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
    customer.notas.trim() !== ''

  function getCartQty(varianteId: number) {
    return cart.find((i) => i.variante_id === varianteId)?.cantidad ?? 0
  }

  function loadWompiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).WidgetCheckout) return resolve()
    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Wompi'))
    document.body.appendChild(script)
  })
}

async function handleOrder(e: React.FormEvent) {
  e.preventDefault()
  if (cart.length === 0) return
  setLoading(true)
  setOrderError(null)

  const res = await fetch('/api/store/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: customer.nombre,
      email: customer.email,
      telefono: customer.telefono,
      ciudad: customer.ciudad,
      direccion: customer.direccion,
      notas: customer.notas,
      total: cartTotal,
      items: cart.map((i) => ({
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.precio * i.cantidad,
      })),
    }),
  })
  const data = await res.json()

  if (!res.ok) {
    setLoading(false)
    setOrderError(data.error ?? 'Ocurrió un error al registrar el pedido. Intenta de nuevo.')
    return
  }

  try {
    await loadWompiScript()
    // El WAF de Wompi bloquea (403) cualquier redirect-url que contenga
    // "localhost", sin importar el esquema. En local se omite: el flujo del
    // Widget ya confirma vía el callback de checkout.open(), no depende de
    // la redirección.
    const isLocalhost = window.location.hostname === 'localhost'
    const checkout = new (window as any).WidgetCheckout({
      currency: data.wompi.currency,
      amountInCents: data.wompi.amountInCents,
      reference: data.wompi.reference,
      publicKey: data.wompi.publicKey,
      signature: { integrity: data.wompi.signature },
      ...(isLocalhost ? {} : { redirectUrl: `${window.location.origin}/store` }),
    })
    checkout.open(() => {
      setOrderNumber(data.order_id)
      setCart([])
      setCheckoutOpen(false)
      setOrderDone(true)
    })
  } catch {
    setOrderError('No se pudo abrir la pasarela de pago. Intenta de nuevo.')
  }
  setLoading(false)
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
            const inCart = getCartQty(product.variante_id)
            return (
              <div key={product.variante_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col active:scale-[0.98] hover:shadow-md hover:border-blue-200 transition-all">
                <div
                  className={`relative bg-gray-100 aspect-[3/4] ${product.imagenes?.length > 0 ? 'cursor-zoom-in' : ''}`}
                  onClick={product.imagenes?.length > 0 ? () => setGallery({ images: product.imagenes, idx: 0 }) : undefined}
                >
                  {product.imagen_url ? (
                    <Image src={product.imagen_url} alt={product.label} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                      {product.categoria_slug === 'album' && <BookOpen className="h-8 w-8 sm:h-10 sm:w-10" />}
                      {product.categoria_slug === 'lamina' && <Layers className="h-8 w-8 sm:h-10 sm:w-10" />}
                      {(product.categoria_slug === 'combo' || product.categoria_slug === 'sobre' || product.categoria_slug === 'caja') && <Package2 className="h-8 w-8 sm:h-10 sm:w-10" />}
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
                  {product.comboItems.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] sm:text-xs font-medium text-gray-600">Incluye:</p>
                      <ul className="text-[10px] sm:text-xs text-gray-500 space-y-0.5">
                        {product.comboItems.map((item, i) => (
                          <li key={i}>
                            <span className="line-clamp-2">• {item.label}</span>
                            {item.notas && <span className="block pl-2 text-gray-400 italic line-clamp-2">{item.notas}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                            const idx = cart.findIndex(i => i.variante_id === product.variante_id)
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
