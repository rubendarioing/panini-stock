import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWompiEventChecksum } from '@/lib/wompi'

export async function POST(request: Request) {
  const payload = await request.json()

  if (!verifyWompiEventChecksum(payload)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  if (payload.event !== 'transaction.updated') {
    return NextResponse.json({ ok: true })
  }

  const transaction = payload.data?.transaction
  const saleId = Number(transaction?.reference)
  const status = transaction?.status as string | undefined

  if (!saleId || !status) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Idempotencia: Wompi reintenta el webhook si no responde 200. Si la venta
  // ya salió de 'pendiente', no reprocesar.
  const { data: sale } = await supabase.from('sales').select('id, estado').eq('id', saleId).maybeSingle()
  if (!sale || sale.estado !== 'pendiente') {
    return NextResponse.json({ ok: true })
  }

  if (status === 'APPROVED') {
    await supabase.from('sales').update({ estado: 'confirmado' }).eq('id', saleId)
  } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
    await supabase.from('sales').update({ estado: 'cancelado' }).eq('id', saleId)

    // Reponer el stock reservado al crear el pedido
    const { data: items } = await supabase
      .from('sale_items_v2')
      .select('variante_id, cantidad')
      .eq('sale_id', saleId)

    // Combos incluidos: se repone su stock propio (031_combos_stock_reservado.sql).
    for (const item of items ?? []) {
      await supabase.rpc('reponer_inventario', {
        p_variante_id: item.variante_id,
        p_cantidad: item.cantidad,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
