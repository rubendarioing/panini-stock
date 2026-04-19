'use client'

import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { ShoppingCart, X, Plus, Minus, BookOpen, Layers, Package2, Search, CheckCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

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

export default function StoreClient({ albumStock, stickerStock, combos, collectionTypes }: {
  albumStock: any[]
  stickerStock: any[]
  combos: any[]
  collectionTypes: any[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderDone, setOrderDone] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [comprobante, setComprobante] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customer, setCustomer] = useState({
    nombre: '', email: '', telefono: '', ciudad: '', direccion: '', notas: '',
  })

  const products = useMemo(() => {
    const list: any[] = []

    albumStock.forEach((s) => {
      list.push({
        id: `album-${s.id}`,
        tipo: 'album',
        referencia_id: s.id,
        label: s.albums?.nombre ?? 'Álbum',
        sublabel: `${s.albums?.collection_types?.nombre ?? ''} ${s.albums?.anio ?? ''}`.trim(),
        categoria: s.albums?.collection_types?.nombre ?? 'Otros',
        type_id: s.albums?.type_id,
        imagen_url: s.albums?.imagen_url,
        precio: s.precio_venta,
        stock: s.cantidad,
        estado: s.estado,
        condicion: s.condicion,
        badge: s.estado === 'lleno' ? 'Lleno' : s.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío',
        badgeVariant: s.estado === 'lleno' ? 'success' : s.estado === 'set_a_pegar' ? 'warning' : 'secondary',
      })
    })

    stickerStock.forEach((s) => {
      list.push({
        id: `sticker-${s.id}`,
        tipo: 'sticker',
        referencia_id: s.id,
        label: `Lámina #${s.stickers?.numero}`,
        sublabel: `${s.stickers?.albums?.nombre ?? ''} — ${s.stickers?.albums?.collection_types?.nombre ?? ''} ${s.stickers?.albums?.anio ?? ''}`.trim(),
        categoria: 'Láminas',
        type_id: null,
        imagen_url: s.imagen_url ?? null,
        descripcion: s.stickers?.descripcion ?? '',
        notas: s.notas ?? '',
        precio: s.precio_venta,
        stock: s.cantidad,
        badge: s.es_repetida ? 'Repetida' : 'Normal',
        badgeVariant: s.es_repetida ? 'warning' : 'secondary',
      })
    })

    combos.forEach((c) => {
      list.push({
        id: `combo-${c.id}`,
        tipo: 'combo',
        referencia_id: c.id,
        label: c.nombre,
        sublabel: c.descripcion,
        categoria: 'Combos',
        type_id: null,
        imagen_url: null,
        precio: c.precio_total,
        stock: 999,
        badge: 'Combo',
        badgeVariant: 'default',
      })
    })

    return list
  }, [albumStock, stickerStock, combos])

  const categories = [
    { value: 'all', label: 'Todo' },
    ...collectionTypes.map((t: any) => ({ value: t.nombre, label: t.nombre })),
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

  function getCartQty(tipo: string, refId: number) {
    return cart.find((i) => i.tipo === tipo && i.referencia_id === refId)?.cantidad ?? 0
  }

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return
    setLoading(true)

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
    }
  }

  if (orderDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center bg-gray-100 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Pedido registrado!</h2>
          <p className="text-gray-500 mb-1">Tu número de pedido es:</p>
          <p className="text-3xl font-bold text-blue-700 mb-4">#{orderNumber}</p>
          <p className="text-gray-500 max-w-sm mx-auto mb-8">
            Nos pondremos en contacto contigo pronto para coordinar la entrega.
          </p>
          <Button
            className="bg-[#003DA5] hover:bg-[#002d80] text-white w-full"
            onClick={() => {
              setOrderDone(false)
              setCustomer({ nombre: '', email: '', telefono: '', ciudad: '', direccion: '', notas: '' })
              setComprobante(null)
            }}
          >
            Seguir comprando
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Barra de anuncio roja */}
      <div className="bg-[#E30613] text-white text-center text-sm py-2 px-4 font-medium tracking-wide">
        🚀 Envío disponible a todo el país — ¡Consulta disponibilidad!
      </div>

      {/* Header azul */}
      <header className="bg-[#003DA5] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            {/* Buscador */}
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar álbum, lámina..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-full text-sm bg-white/10 text-white placeholder-blue-200 border border-blue-300/40 focus:outline-none focus:bg-white/20 transition"
              />
            </div>

            {/* Logo centrado */}
            <div className="flex-1 flex justify-center">
              <div className="bg-[#FFD600] px-4 py-1 rounded font-black text-[#E30613] text-2xl tracking-widest select-none shadow">
                PANINI
              </div>
            </div>

            {/* Derecha: admin + carrito */}
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="hidden sm:inline text-xs text-blue-200 hover:text-white transition-colors"
              >
                Administración →
              </a>
              <button
                onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 text-sm font-medium transition border border-white/20"
              >
                <ShoppingCart className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#E30613] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
                <span className="hidden sm:inline">Carrito</span>
                {cartCount > 0 && (
                  <span className="hidden sm:inline font-bold">{formatCurrency(cartTotal)}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Barra de categorías */}
        <div className="bg-[#002d80] border-t border-blue-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto">
            <div className="flex items-center gap-1 h-10 whitespace-nowrap">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  className={`px-4 h-full text-sm font-medium transition-colors flex-shrink-0 ${
                    filterCategory === cat.value
                      ? 'bg-[#FFD600] text-[#003DA5] font-bold'
                      : 'text-blue-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Buscador mobile */}
      <div className="sm:hidden px-4 pt-4 bg-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar álbum, lámina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white border border-gray-200 focus:outline-none focus:border-blue-400 shadow-sm"
          />
        </div>
      </div>

      {/* Contenido principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No se encontraron productos</p>
            <p className="text-sm mt-1">Intenta con otro término o categoría</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => {
              const inCart = getCartQty(product.tipo, product.referencia_id)
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-150"
                >
                  <div className="relative bg-gray-100 aspect-[3/4]">
                    {product.imagen_url ? (
                      <Image src={product.imagen_url} alt={product.label} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                        {product.tipo === 'album' && <BookOpen className="h-10 w-10" />}
                        {product.tipo === 'sticker' && <Layers className="h-10 w-10" />}
                        {product.tipo === 'combo' && <Package2 className="h-10 w-10" />}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge variant={product.badgeVariant as any} className="text-xs shadow-sm">{product.badge}</Badge>
                    </div>
                    {product.stock < 5 && product.stock < 999 && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="destructive" className="text-xs shadow-sm">¡Últimas!</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{product.label}</p>
                    {product.sublabel && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.sublabel}</p>}
                    <div className="mt-auto pt-2">
                      <p className="text-lg font-bold text-[#003DA5]">{formatCurrency(product.precio)}</p>
                      {product.stock < 999 && (
                        <p className="text-xs text-gray-400">{product.stock} disponibles</p>
                      )}
                      {inCart === 0 ? (
                        <button
                          onClick={() => addToCart(product)}
                          className="mt-2 w-full bg-[#003DA5] hover:bg-[#002d80] text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ShoppingCart className="h-4 w-4" /> Agregar
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                          <button
                            onClick={() => {
                              const idx = cart.findIndex(i => i.tipo === product.tipo && i.referencia_id === product.referencia_id)
                              updateQty(idx, -1)
                            }}
                            className="p-1 text-[#003DA5] hover:bg-blue-100 rounded"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-[#003DA5] font-bold text-sm">{inCart}</span>
                          <button onClick={() => addToCart(product)} className="p-1 text-[#003DA5] hover:bg-blue-100 rounded">
                            <Plus className="h-4 w-4" />
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
      </main>

      {/* Footer */}
      <footer className="bg-[#003DA5] text-blue-200 text-center text-sm py-5 mt-8">
        <span className="font-bold text-[#FFD600]">PANINI</span> Stock &copy; {new Date().getFullYear()} — Todos los derechos reservados
      </footer>

      {/* Panel carrito lateral */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white w-full max-w-sm flex flex-col shadow-2xl">
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
            {cart.length > 0 && (
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
            )}
          </div>
        </div>
      )}

      {/* Modal checkout */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCheckoutOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
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

            <form onSubmit={handleOrder} className="p-5 space-y-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500">Completa tus datos para registrar el pedido.</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nombre completo *</Label>
                  <Input placeholder="Tu nombre" value={customer.nombre} onChange={(e) => setCustomer({ ...customer, nombre: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp / Teléfono *</Label>
                  <Input placeholder="Ej: 3001234567" value={customer.telefono} onChange={(e) => setCustomer({ ...customer, telefono: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Correo electrónico</Label>
                  <Input type="email" placeholder="tu@email.com" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad *</Label>
                  <Input placeholder="Tu ciudad" value={customer.ciudad} onChange={(e) => setCustomer({ ...customer, ciudad: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección de envío *</Label>
                  <Input placeholder="Calle, barrio..." value={customer.direccion} onChange={(e) => setCustomer({ ...customer, direccion: e.target.value })} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Notas (opcional)</Label>
                  <Input placeholder="Observaciones adicionales..." value={customer.notas} onChange={(e) => setCustomer({ ...customer, notas: e.target.value })} />
                </div>
              </div>

              {/* Comprobante de pago */}
              <div className="space-y-1.5">
                <Label>Comprobante de pago (opcional)</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#003DA5] hover:bg-[#002d80] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-base"
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
