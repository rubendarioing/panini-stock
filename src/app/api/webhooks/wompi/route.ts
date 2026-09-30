import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
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

  // Pago aprobado de un pedido que ya se canceló (expiró por tiempo o se canceló
  // a mano) y cuyo stock ya se repuso: intentar reservarlo de nuevo.
  if (sale?.estado === 'cancelado' && status === 'APPROVED') {
    await confirmarPagoTardio(supabase, saleId)
    return NextResponse.json({ ok: true })
  }

  if (!sale || sale.estado !== 'pendiente') {
    return NextResponse.json({ ok: true })
  }

  // Updates condicionados a 'pendiente': si otro proceso (reintento del webhook
  // o cancelación manual desde /sales) ya la movió, no se repite el efecto.
  if (status === 'APPROVED') {
    await supabase.from('sales').update({ estado: 'confirmado' }).eq('id', saleId).eq('estado', 'pendiente')
  } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
    const { data: cancelada } = await supabase
      .from('sales').update({ estado: 'cancelado' })
      .eq('id', saleId).eq('estado', 'pendiente')
      .select('id')
    if (!cancelada?.length) {
      return NextResponse.json({ ok: true })
    }

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

async function confirmarPagoTardio(supabase: SupabaseClient, saleId: number) {
  const { data: items } = await supabase
    .from('sale_items_v2')
    .select('variante_id, cantidad')
    .eq('sale_id', saleId)

  const descontados: { variante_id: number; cantidad: number }[] = []
  let sinStock = false
  for (const item of items ?? []) {
    const { data: ok } = await supabase.rpc('descontar_inventario', {
      p_variante_id: item.variante_id,
      p_cantidad: item.cantidad,
    })
    if (!ok) { sinStock = true; break }
    descontados.push(item)
  }

  const reponer = async () => {
    for (const d of descontados) {
      await supabase.rpc('reponer_inventario', { p_variante_id: d.variante_id, p_cantidad: d.cantidad })
    }
  }

  if (!sinStock) {
    // Condicionado a 'cancelado': si una entrega duplicada del webhook ya lo
    // confirmó, devolver lo que se acaba de descontar.
    const { data: confirmada } = await supabase
      .from('sales').update({ estado: 'confirmado' })
      .eq('id', saleId).eq('estado', 'cancelado')
      .select('id')
    if (!confirmada?.length) await reponer()
    return
  }

  await reponer()
  console.error(`Pedido #${saleId}: Wompi aprobó el pago después de cancelado y ya no hay stock.`)
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Panini Stock <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL!,
      subject: `⚠️ Pedido #${saleId}: pago aprobado sin stock`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h1 style="font-size:18px">⚠️ Pago aprobado de un pedido cancelado</h1>
          <p style="font-size:14px">Wompi aprobó el pago del pedido <strong>#${saleId}</strong> después de que se canceló
          (por expiración o manualmente), y ya no hay stock suficiente para despacharlo.</p>
          <p style="font-size:14px">El pedido sigue en estado <strong>cancelado</strong>. Contacta al cliente para
          ofrecer un reemplazo o gestionar el reembolso desde el panel de Wompi.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('No se pudo enviar el aviso de pago tardío:', err)
  }
}
