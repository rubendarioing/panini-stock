import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { labelForVariante } from '@/lib/product-labels'

type OrderItem = {
  variante_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export async function POST(request: Request) {
  const formData = await request.formData()

  const nombre       = formData.get('nombre') as string
  const email        = formData.get('email') as string
  const telefono     = formData.get('telefono') as string
  const ciudad       = formData.get('ciudad') as string
  const direccion    = formData.get('direccion') as string
  const notas        = formData.get('notas') as string
  const total        = Number(formData.get('total'))
  const items        = JSON.parse(formData.get('items') as string) as OrderItem[]
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

  // Cargar todas las variantes del carrito en una sola consulta (producto,
  // categoría, colección e inventario actual). Todo item del carrito —álbum,
  // sobre, caja, lámina o combo— es una fila de producto_variantes.
  const varianteIds = [...new Set(items.map((i) => i.variante_id))]
  const { data: variantes } = await supabase
    .from('producto_variantes')
    .select(`
      id, estado, es_repetida, unidades_contenidas, legacy_table, legacy_id,
      inventario ( cantidad ),
      productos ( nombre, anio, descripcion, categorias ( slug ), collection_types ( nombre ) )
    `)
    .in('id', varianteIds)

  const varianteMap = new Map((variantes ?? []).map((v: any) => [v.id, v]))
  const labelFor = labelForVariante

  // Combos: cargar sus componentes (con la variante e inventario de cada uno)
  // en una sola consulta, agrupados por combo_id (= producto_variantes.legacy_id
  // cuando legacy_table = 'combos').
  const comboLegacyIds = [...new Set(
    (variantes ?? []).filter((v: any) => v.legacy_table === 'combos').map((v: any) => v.legacy_id)
  )]

  const { data: componentesRaw } = comboLegacyIds.length
    ? await supabase
        .from('combo_componentes')
        .select('combo_id, cantidad, variante_id, producto_variantes ( inventario ( cantidad ), productos ( nombre ) )')
        .in('combo_id', comboLegacyIds)
    : { data: [] as any[] }

  const componentesPorCombo = new Map<number, any[]>()
  for (const c of componentesRaw ?? []) {
    const list = componentesPorCombo.get(c.combo_id) ?? []
    list.push(c)
    componentesPorCombo.set(c.combo_id, list)
  }

  // Validar stock antes de procesar
  for (const item of items) {
    const v = varianteMap.get(item.variante_id)
    if (!v) {
      return NextResponse.json({ error: 'Uno de los productos del carrito ya no existe.' }, { status: 409 })
    }

    if (v.legacy_table === 'combos') {
      const componentes = componentesPorCombo.get(v.legacy_id) ?? []
      for (const c of componentes) {
        const unidades = c.cantidad * item.cantidad
        const disponible = c.producto_variantes?.inventario?.cantidad ?? 0
        if (disponible < unidades) {
          const nombreComp = c.producto_variantes?.productos?.nombre ?? 'un componente'
          return NextResponse.json(
            { error: `Stock insuficiente para "${nombreComp}" (componente de "${v.productos?.nombre}"). Disponible: ${disponible}.` },
            { status: 409 }
          )
        }
      }
    } else {
      const disponible = v.inventario?.cantidad ?? 0
      if (disponible < item.cantidad) {
        return NextResponse.json(
          { error: `Stock insuficiente para "${labelFor(v)}". Disponible: ${disponible}.` },
          { status: 409 }
        )
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
  const { error: itemsError } = await supabase.from('sale_items_v2').insert(
    items.map((i) => ({
      sale_id: sale.id,
      variante_id: i.variante_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    }))
  )

  if (itemsError) {
    // Revertir la venta si no se pudieron guardar los items
    await supabase.from('sales').delete().eq('id', sale.id)
    return NextResponse.json({ error: `Error al guardar los productos del pedido: ${itemsError.message}` }, { status: 500 })
  }

  // Descontar stock de forma atómica (descontar_inventario solo resta si hay
  // suficiente cantidad, evitando sobreventa entre la validación de arriba y
  // este punto bajo pedidos concurrentes). Si algo falla a mitad de camino,
  // se repone lo ya descontado y se revierte la venta completa.
  const decrementados: { variante_id: number; cantidad: number }[] = []
  let stockError: string | null = null

  for (const item of items) {
    const v = varianteMap.get(item.variante_id)

    if (v?.legacy_table === 'combos') {
      const componentes = componentesPorCombo.get(v.legacy_id) ?? []
      for (const c of componentes) {
        const unidades = c.cantidad * item.cantidad
        const { data: ok } = await supabase.rpc('descontar_inventario', {
          p_variante_id: c.variante_id,
          p_cantidad: unidades,
        })
        if (ok) {
          decrementados.push({ variante_id: c.variante_id, cantidad: unidades })
        } else {
          stockError = `Se agotó el stock de "${c.producto_variantes?.productos?.nombre ?? 'un componente'}" antes de confirmar tu pedido.`
          break
        }
      }
    } else {
      const { data: ok } = await supabase.rpc('descontar_inventario', {
        p_variante_id: item.variante_id,
        p_cantidad: item.cantidad,
      })
      if (ok) {
        decrementados.push({ variante_id: item.variante_id, cantidad: item.cantidad })
      } else {
        stockError = `Se agotó el stock de "${labelFor(v)}" antes de confirmar tu pedido.`
      }
    }

    if (stockError) break
  }

  if (stockError) {
    for (const d of decrementados) {
      await supabase.rpc('reponer_inventario', { p_variante_id: d.variante_id, p_cantidad: d.cantidad })
    }
    await supabase.from('sale_items_v2').delete().eq('sale_id', sale.id)
    await supabase.from('sales').delete().eq('id', sale.id)
    return NextResponse.json({ error: `${stockError} Por favor intenta de nuevo.` }, { status: 409 })
  }

  // Enviar notificación al admin
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const formatCurrency = (n: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

    const emoji: Record<string, string> = { album: '📘', lamina: '🃏', combo: '🎁', sobre: '📦', caja: '📦' }
    const itemsHtml = items.map((i) => {
      const v = varianteMap.get(i.variante_id)
      const categoria = v?.productos?.categorias?.slug ?? 'producto'
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0">
          <span style="font-size:16px">${emoji[categoria] ?? '📦'}</span>
          <span style="font-size:13px;color:#1a1a1a;margin-left:6px">${labelFor(v)}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px">${i.cantidad}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${formatCurrency(i.subtotal)}</td>
      </tr>`
    }).join('')

    await resend.emails.send({
      from: 'Panini Stock <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL!,
      subject: `🛒 Nuevo pedido #${sale.id} — ${nombre}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#003DA5;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">🛒 Nuevo pedido recibido</h1>
            <p style="color:#93b4f0;margin:4px 0 0;font-size:14px">Pedido #${sale.id}</p>
          </div>
          <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none">

            <h2 style="font-size:15px;margin:0 0 12px;color:#374151">Datos del cliente</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px">
              <tr><td style="padding:4px 0;color:#6b7280;width:120px">Nombre</td><td style="padding:4px 0;font-weight:600">${nombre}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">WhatsApp</td><td style="padding:4px 0"><a href="https://wa.me/${telefono}" style="color:#003DA5">${telefono}</a></td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0">${email}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Ciudad</td><td style="padding:4px 0">${ciudad}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Dirección</td><td style="padding:4px 0">${direccion}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Notas</td><td style="padding:4px 0">${notas}</td></tr>
            </table>

            <h2 style="font-size:15px;margin:0 0 12px;color:#374151">Productos</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:6px 8px;text-align:left;color:#6b7280;font-weight:500">Tipo</th>
                  <th style="padding:6px 8px;text-align:center;color:#6b7280;font-weight:500">Cant.</th>
                  <th style="padding:6px 8px;text-align:right;color:#6b7280;font-weight:500">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="background:#f0f4ff;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
              <span style="font-size:15px;font-weight:600;color:#374151">Total del pedido</span>
              <span style="font-size:18px;font-weight:700;color:#003DA5">${formatCurrency(total)}</span>
            </div>

            ${comprobanteUrl ? `<p style="margin:0 0 20px"><a href="${comprobanteUrl}" style="background:#003DA5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver comprobante de pago</a></p>` : ''}

            <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://panini-stock.vercel.app'}/sales` : '#'}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
              Ver en el dashboard →
            </a>
          </div>
          <div style="padding:12px 32px;text-align:center;font-size:12px;color:#9ca3af">
            Panini Stock · Notificación automática
          </div>
        </div>
      `,
    })
  } catch (_) {
    // El email es best-effort, no bloquea la respuesta
  }

  return NextResponse.json({ ok: true, order_id: sale.id })
}
