'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle } from 'lucide-react'
import { getWhatsAppUrl } from '@/components/store/WhatsAppButton'

export default function SettingsClient({ config }: { config: any }) {
  const [form, setForm] = useState({
    whatsapp: config?.whatsapp ?? '',
    mensaje_whatsapp: config?.mensaje_whatsapp ?? '',
    email_contacto: config?.email_contacto ?? '',
    instagram_url: config?.instagram_url ?? '',
    facebook_url: config?.facebook_url ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Formato que exige wa.me (y el CHECK de 037): solo dígitos, con indicativo.
  const whatsappLimpio = form.whatsapp.replace(/\D/g, '')
  const whatsappValido = whatsappLimpio === '' || /^[0-9]{8,15}$/.test(whatsappLimpio)

  function set(campo: keyof typeof form, valor: string) {
    setForm({ ...form, [campo]: valor })
    setGuardado(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!whatsappValido) return
    setLoading(true)
    const { data, error } = await supabase
      .from('configuracion_tienda')
      .update({
        whatsapp: whatsappLimpio || null,
        mensaje_whatsapp: form.mensaje_whatsapp.trim() || null,
        email_contacto: form.email_contacto.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('id')
    setLoading(false)
    if (error) { alert(`No se pudo guardar: ${error.message}`); return }
    // Sin filas actualizadas = RLS lo bloqueó (no es admin) o falta la fila de 037.
    if (!data?.length) { alert('No se pudo guardar: verifica que tu usuario sea administrador.'); return }
    setGuardado(true)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Datos de contacto que se muestran en la tienda</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>WhatsApp</Label>
          <Input
            placeholder="Ej: 573001234567"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            inputMode="numeric"
          />
          {whatsappValido ? (
            <p className="text-xs text-gray-400">
              Con indicativo del país y sin &quot;+&quot; ni espacios (Colombia: 57 + el número). Vacío = se oculta el botón.
            </p>
          ) : (
            <p className="text-xs text-red-500">Debe tener entre 8 y 15 dígitos, incluyendo el indicativo (ej. 573001234567).</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Mensaje inicial del chat</Label>
          <Textarea
            rows={2}
            value={form.mensaje_whatsapp}
            onChange={(e) => set('mensaje_whatsapp', e.target.value)}
          />
        </div>

        {whatsappLimpio && whatsappValido && (
          <a
            href={getWhatsAppUrl(whatsappLimpio, form.mensaje_whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline"
          >
            <MessageCircle className="h-4 w-4" /> Probar enlace de WhatsApp
          </a>
        )}

        <div className="space-y-1.5">
          <Label>Correo de contacto (opcional)</Label>
          <Input type="email" value={form.email_contacto} onChange={(e) => set('email_contacto', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Instagram (opcional)</Label>
            <Input type="url" placeholder="https://instagram.com/..." value={form.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook (opcional)</Label>
            <Input type="url" placeholder="https://facebook.com/..." value={form.facebook_url} onChange={(e) => set('facebook_url', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading || !whatsappValido}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          {guardado && <span className="text-sm text-green-600">Guardado. La tienda ya muestra los datos nuevos.</span>}
        </div>
      </form>
    </div>
  )
}
