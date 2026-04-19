import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()

  const nombre       = formData.get('nombre') as string
  const email        = formData.get('email') as string
  const telefono     = formData.get('telefono') as string
  const ciudad       = formData.get('ciudad') as string
  const direccion    = formData.get('direccion') as string
  const notas        = formData.get('notas') as string
  const total        = Number(formData.get('total'))
  const items        = JSON.parse(formData.get('items') as string)
  const comprobante  = formData.get('comprobante') as File | null

  if (!nombre || !telefono || !email || !ciudad || !direccion || !notas || !items?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verificar si ya tiene un pedido pendiente con ese teléfono
  const { data: pedidoPendiente } = await supabase
    .from('sales')
    .select('id')
    .eq('cliente_contacto', telefono)
    .eq('estado', 'pendiente')
    .limit(1)
    .maybeSingle()

  if (pedidoPendiente) {
    return NextResponse.json(
      { error: 'Ya tienes un pedido en proceso. Espera a que sea confirmado antes de realizar uno nuevo.' },
      { status: 409 }
    )
  }

  // Buscar cliente existente por teléfono o correo en una sola consulta
  let clienteId: number | null = null
  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', telefono)
    .eq('email', email)
    .maybeSingle()

  if (clienteExistente) {
    clienteId = clienteExistente.id
    await supabase.from('clientes').update({ nombre, email, ciudad, direccion }).eq('id', clienteId)
  } else {
    const { data: nuevoCliente } = await supabase
      .from('clientes')
      .insert({ nombre, email, telefono, ciudad, direccion })
      .select('id')
      .single()
    clienteId = nuevoCliente?.id ?? null
  }

  // Subir comprobante si existe
  let comprobanteUrl: string | null = null
  if (comprobante && comprobante.size > 0) {
    const ext = comprobante.name.split('.').pop()
    const path = `comprobantes/${Date.now()}.${ext}`
    const buffer = await comprobante.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(path, buffer, { contentType: comprobante.type, upsert: false })
    if (!uploadError) {
      const { data } = supabase.storage.from('comprobantes').getPublicUrl(path)
      comprobanteUrl = data.publicUrl
    }
  }

  // Obtener admin para usuario_id
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('rol', 'admin')
    .limit(1)
    .single()

  // Crear venta
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      cliente_nombre: nombre,
      cliente_contacto: telefono,
      email_cliente: email || null,
      direccion_envio: direccion || null,
      ciudad: ciudad || null,
      notas: notas || null,
      total,
      metodo_pago: 'otro',
      estado: 'pendiente',
      comprobante_url: comprobanteUrl,
      cliente_id: clienteId,
      fecha: new Date().toISOString(),
      usuario_id: adminProfile!.id,
    })
    .select()
    .single()

  if (saleError || !sale) {
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }

  // Insertar items
  await supabase.from('sale_items').insert(
    items.map((i: any) => ({
      sale_id: sale.id,
      tipo: i.tipo,
      referencia_id: i.referencia_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    }))
  )

  // Descontar stock
  for (const item of items) {
    const tabla = item.tipo === 'album' ? 'stock_albums' : item.tipo === 'sticker' ? 'stock_stickers' : null
    if (!tabla) continue
    const { data: current } = await supabase.from(tabla).select('cantidad').eq('id', item.referencia_id).single()
    if (current) {
      await supabase.from(tabla).update({ cantidad: Math.max(0, current.cantidad - item.cantidad) }).eq('id', item.referencia_id)
    }
  }

  return NextResponse.json({ ok: true, order_id: sale.id })
}
