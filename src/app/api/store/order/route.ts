import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

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
  const { error: itemsError } = await supabase.from('sale_items').insert(
    items.map((i: any) => ({
      sale_id: sale.id,
      tipo: i.tipo,
      referencia_id: i.referencia_id,
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

  // Enviar notificación al admin
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const formatCurrency = (n: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

    // Construir etiquetas detalladas por item
    async function buildItemLabel(i: any): Promise<string> {
      if (i.tipo === 'album') {
        const { data: s } = await supabase.from('stock_albums')
          .select('estado, albums(nombre, anio, collection_types(nombre))')
          .eq('id', i.referencia_id).single()
        if (!s) return 'Álbum'
        const a = (s as any).albums
        const col = a?.collection_types?.nombre ?? ''
        const estadoLabel = s.estado === 'lleno' ? 'Lleno' : s.estado === 'set_a_pegar' ? 'Set a Pegar' : 'Vacío'
        return `Álbum ${a?.nombre ?? ''} ${a?.anio ?? ''}${col ? ` — ${col}` : ''} · ${estadoLabel}`
      }
      if (i.tipo === 'sticker') {
        const { data: s } = await supabase.from('stock_stickers')
          .select('stickers(numero, descripcion, albums(nombre, anio, collection_types(nombre)))')
          .eq('id', i.referencia_id).single()
        if (!s) return 'Lámina'
        const st = (s as any).stickers
        const col = st?.albums?.collection_types?.nombre ?? ''
        const album = `${st?.albums?.nombre ?? ''} ${st?.albums?.anio ?? ''}`.trim()
        return `Lámina #${st?.numero}${st?.descripcion ? ` "${st.descripcion}"` : ''} · ${album}${col ? ` — ${col}` : ''}`
      }
      if (i.tipo === 'accesorio') {
        const { data: s } = await supabase.from('stock_accesorios')
          .select('tipo, cantidad_contenido, albums(nombre, anio, collection_types(nombre))')
          .eq('id', i.referencia_id).single()
        if (!s) return 'Accesorio'
        const tipoLabel = (s as any).tipo === 'sobre' ? 'Sobre' : 'Caja Sellada'
        const contenido = (s as any).cantidad_contenido
          ? ` (${(s as any).cantidad_contenido} ${(s as any).tipo === 'sobre' ? 'láminas' : 'sobres'})`
          : ''
        const a = (s as any).albums
        const col = a?.collection_types?.nombre ?? ''
        return `${tipoLabel}${contenido} de ${a?.nombre ?? ''} ${a?.anio ?? ''}${col ? ` — ${col}` : ''}`
      }
      if (i.tipo === 'combo') {
        const { data: c } = await supabase.from('combos').select('nombre').eq('id', i.referencia_id).single()
        return `Combo: ${(c as any)?.nombre ?? ''}`
      }
      return i.tipo
    }

    const itemLabels = await Promise.all(items.map(buildItemLabel))

    const emoji: Record<string, string> = { album: '📘', sticker: '🃏', combo: '🎁', accesorio: '📦' }
    const itemsHtml = items.map((i: any, idx: number) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0">
          <span style="font-size:16px">${emoji[i.tipo] ?? '📦'}</span>
          <span style="font-size:13px;color:#1a1a1a;margin-left:6px">${itemLabels[idx]}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px">${i.cantidad}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${formatCurrency(i.subtotal)}</td>
      </tr>`
    ).join('')

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
