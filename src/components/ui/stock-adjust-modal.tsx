'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  tabla: 'stock_albums' | 'stock_stickers' | 'stock_accesorios'
  item: {
    id: number
    cantidad: number
    nombre: string
    precio_compra: number
    precio_venta: number
  }
}

export default function StockAdjustModal({ open, onClose, tabla, item }: Props) {
  const [tipo, setTipo] = useState<'compra' | 'venta' | 'ajuste'>('compra')
  const [cantidad, setCantidad] = useState('1')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const delta = Number(cantidad) || 0
  const nuevaCantidad = tipo === 'compra' || tipo === 'ajuste'
    ? item.cantidad + delta
    : Math.max(0, item.cantidad - delta)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from(tabla).update({ cantidad: nuevaCantidad }).eq('id', item.id)
    setLoading(false)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-gray-500 mb-2 line-clamp-1">{item.nombre}</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Motivo del ajuste</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compra">Compra (aumentar stock)</SelectItem>
                <SelectItem value="venta">Venta directa (disminuir stock)</SelectItem>
                <SelectItem value="ajuste">Ajuste manual (aumentar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Stock actual:</span>
              <span className="font-medium">{item.cantidad}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Movimiento:</span>
              <span className={`font-medium flex items-center gap-1 ${tipo === 'venta' ? 'text-red-500' : 'text-green-600'}`}>
                {tipo === 'venta'
                  ? <><TrendingDown className="h-3.5 w-3.5" />-{delta}</>
                  : <><TrendingUp className="h-3.5 w-3.5" />+{delta}</>
                }
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-700 font-medium">Stock resultante:</span>
              <span className={`font-bold text-base ${nuevaCantidad === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                {nuevaCantidad}
              </span>
            </div>
            {tipo === 'venta' && (
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Ingreso estimado:</span>
                <span className="text-green-600 font-medium">{formatCurrency(item.precio_venta * delta)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Confirmar ajuste'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
