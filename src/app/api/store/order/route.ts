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

  // Validar stock antes de procesar
  for (const item of items) {
    if (item.tipo === 'album') {
      const { data: s } = await supabase.from('stock_albums').select('cantidad, albums(nombre)').eq('id', item.referencia_id).single()
      if (!s || s.cantidad < item.cantidad) {
        const nombre = (s as any)?.albums?.nombre ?? 'álbum'
        return NextResponse.json({ error: `Stock insuficiente para "${nombre}". Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
      }
    } else if (item.tipo === 'sticker') {
      const { data: s } = await supabase.from('stock_stickers').select('cantidad, stickers(numero)').eq('id', item.referencia_id).single()
      if (!s || s.cantidad < item.cantidad) {
        const num = (s as any)?.stickers?.numero ?? item.referencia_id
        return NextResponse.json({ error: `Stock insuficiente para la lámina #${num}. Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
      }
    } else if (item.tipo === 'accesorio') {
      const { data: s } = await supabase.from('stock_accesorios').select('cantidad, tipo, albums(nombre)').eq('id', item.referencia_id).single()
      if (!s || s.cantidad < item.cantidad) {
        const label = `${(s as any)?.tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'} — ${(s as any)?.albums?.nombre ?? ''}`
        return NextResponse.json({ error: `Stock insuficiente para "${label.trim()}". Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
      }
    } else if (item.tipo === 'combo') {
      const { data: comboItems } = await supabase
        .from('combo_items')
        .select('tipo, cantidad, stock_album_id, stock_sticker_id, stock_accesorio_id')
        .eq('combo_id', item.referencia_id)

      if (comboItems) {
        for (const ci of comboItems) {
          const unidades = ci.cantidad * item.cantidad
          if (ci.tipo === 'album' && ci.stock_album_id) {
            const { data: s } = await supabase.from('stock_albums').select('cantidad, albums(nombre)').eq('id', ci.stock_album_id).single()
            if (!s || s.cantidad < unidades) {
              const nombre = (s as any)?.albums?.nombre ?? 'álbum del combo'
              return NextResponse.json({ error: `Stock insuficiente para "${nombre}" (componente del combo). Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
            }
          } else if (ci.tipo === 'sticker' && ci.stock_sticker_id) {
            const { data: s } = await supabase.from('stock_stickers').select('cantidad, stickers(numero)').eq('id', ci.stock_sticker_id).single()
            if (!s || s.cantidad < unidades) {
              const num = (s as any)?.stickers?.numero ?? ci.stock_sticker_id
              return NextResponse.json({ error: `Stock insuficiente para la lámina #${num} (componente del combo). Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
            }
          } else if (ci.tipo === 'accesorio' && ci.stock_accesorio_id) {
            const { data: s } = await supabase.from('stock_accesorios').select('cantidad, tipo, albums(nombre)').eq('id', ci.stock_accesorio_id).single()
            if (!s || s.cantidad < unidades) {
              const label = `${(s as any)?.tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'} — ${(s as any)?.albums?.nombre ?? ''}`
              return NextResponse.json({ error: `Stock insuficiente para "${label.trim()}" (componente del combo). Disponible: ${s?.cantidad ?? 0}.` }, { status: 409 })
            }
          }
        }
      }
    }
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
    if (item.tipo === 'album') {
      const { data: current } = await supabase.from('stock_albums').select('cantidad').eq('id', item.referencia_id).single()
      if (current) {
        await supabase.from('stock_albums').update({ cantidad: Math.max(0, current.cantidad - item.cantidad) }).eq('id', item.referencia_id)
      }
    } else if (item.tipo === 'sticker') {
      const { data: current } = await supabase.from('stock_stickers').select('cantidad').eq('id', item.referencia_id).single()
      if (current) {
        await supabase.from('stock_stickers').update({ cantidad: Math.max(0, current.cantidad - item.cantidad) }).eq('id', item.referencia_id)
      }
    } else if (item.tipo === 'accesorio') {
      const { data: current } = await supabase.from('stock_accesorios').select('cantidad').eq('id', item.referencia_id).single()
      if (current) {
        await supabase.from('stock_accesorios').update({ cantidad: Math.max(0, current.cantidad - item.cantidad) }).eq('id', item.referencia_id)
      }
    } else if (item.tipo === 'combo') {
      // Descontar el stock de cada componente del combo
      const { data: comboItems } = await supabase
        .from('combo_items')
        .select('tipo, cantidad, stock_album_id, stock_sticker_id, stock_accesorio_id')
        .eq('combo_id', item.referencia_id)

      if (comboItems) {
        for (const ci of comboItems) {
          const unidades = ci.cantidad * item.cantidad
          if (ci.tipo === 'album' && ci.stock_album_id) {
            const { data: current } = await supabase.from('stock_albums').select('cantidad').eq('id', ci.stock_album_id).single()
            if (current) {
              await supabase.from('stock_albums').update({ cantidad: Math.max(0, current.cantidad - unidades) }).eq('id', ci.stock_album_id)
            }
          } else if (ci.tipo === 'sticker' && ci.stock_sticker_id) {
            const { data: current } = await supabase.from('stock_stickers').select('cantidad').eq('id', ci.stock_sticker_id).single()
            if (current) {
              await supabase.from('stock_stickers').update({ cantidad: Math.max(0, current.cantidad - unidades) }).eq('id', ci.stock_sticker_id)
            }
          } else if (ci.tipo === 'accesorio' && ci.stock_accesorio_id) {
            const { data: current } = await supabase.from('stock_accesorios').select('cantidad').eq('id', ci.stock_accesorio_id).single()
            if (current) {
              await supabase.from('stock_accesorios').update({ cantidad: Math.max(0, current.cantidad - unidades) }).eq('id', ci.stock_accesorio_id)
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, order_id: sale.id })
}
