import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'

// Solo servidor: usa WOMPI_PRIVATE_KEY y el service role.
//
// Un pedido de la tienda reserva stock al crearse (api/store/order). Si el
// cliente cierra el widget sin intentar pagar, Wompi nunca manda el webhook y
// el pedido quedaría 'pendiente' para siempre: stock bloqueado y el teléfono
// sin poder hacer otro pedido. Esto cancela esos pedidos y repone el stock.
//
// Se ejecuta de forma perezosa (al crear un pedido y al abrir la tienda o
// /sales), no con cron.

export const MINUTOS_EXPIRACION_PEDIDO = 30

type EstadoWompi = 'APPROVED' | 'PENDING' | 'SIN_PAGO' | 'DESCONOCIDO'

function wompiBaseUrl() {
  return process.env.WOMPI_PUBLIC_KEY?.startsWith('pub_prod')
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1'
}

// Estado agregado de las transacciones de Wompi para una referencia (= sale.id).
async function consultarWompi(reference: string): Promise<EstadoWompi> {
  try {
    const res = await fetch(`${wompiBaseUrl()}/transactions?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}` },
      cache: 'no-store',
    })
    if (!res.ok) return 'DESCONOCIDO'
    const { data } = await res.json() as { data?: { status: string }[] }
    const estados = (data ?? []).map((t) => t.status)
    if (estados.includes('APPROVED')) return 'APPROVED'
    if (estados.includes('PENDING')) return 'PENDING'
    return 'SIN_PAGO'
  } catch {
    return 'DESCONOCIDO'
  }
}

export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function expirarPedidosPendientes(supabase: SupabaseClient = createServiceClient()) {
  const limite = new Date(Date.now() - MINUTOS_EXPIRACION_PEDIDO * 60_000).toISOString()

  const { data: vencidos, error } = await supabase
    .from('sales')
    .select('id')
    .eq('estado', 'pendiente')
    .eq('metodo_pago', 'wompi')
    .lt('created_at', limite)

  if (error) {
    console.error('No se pudieron consultar pedidos pendientes vencidos:', error)
    return
  }

  for (const sale of vencidos ?? []) {
    const estado = await consultarWompi(String(sale.id))

    // Ante la duda (Wompi no respondió o el pago sigue en proceso) no se toca.
    if (estado === 'DESCONOCIDO' || estado === 'PENDING') continue

    if (estado === 'APPROVED') {
      // Se pagó pero el webhook no llegó: confirmar (el stock ya está descontado).
      await supabase.from('sales').update({ estado: 'confirmado' }).eq('id', sale.id).eq('estado', 'pendiente')
      continue
    }

    // Condicionado a 'pendiente': si el webhook o una cancelación manual la
    // procesó en paralelo, no se repone dos veces.
    const { data: cancelada } = await supabase
      .from('sales')
      .update({ estado: 'cancelado' })
      .eq('id', sale.id).eq('estado', 'pendiente')
      .select('id')
    if (!cancelada?.length) continue

    const { data: items } = await supabase
      .from('sale_items_v2')
      .select('variante_id, cantidad')
      .eq('sale_id', sale.id)

    for (const item of items ?? []) {
      await supabase.rpc('reponer_inventario', { p_variante_id: item.variante_id, p_cantidad: item.cantidad })
    }
  }
}
