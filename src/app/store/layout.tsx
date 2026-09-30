import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { WhatsAppButton, getWhatsAppUrl } from '@/components/store/WhatsAppButton'

export const metadata: Metadata = {
  title: 'Tienda — Pegando Historia Stock',
  description: 'Catálogo de álbumes y láminas Panini',
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Contacto editable en Administración → Configuración (037_configuracion_tienda.sql).
  const supabase = await createClient()
  const { data: config } = await supabase
    .from('configuracion_tienda')
    .select('whatsapp, mensaje_whatsapp, email_contacto, instagram_url, facebook_url')
    .eq('id', 1)
    .maybeSingle()

  const contactos = [
    config?.whatsapp && { label: 'WhatsApp', href: getWhatsAppUrl(config.whatsapp, config.mensaje_whatsapp) },
    config?.email_contacto && { label: config.email_contacto, href: `mailto:${config.email_contacto}` },
    config?.instagram_url && { label: 'Instagram', href: config.instagram_url },
    config?.facebook_url && { label: 'Facebook', href: config.facebook_url },
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#003DA5] border-b border-blue-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="bg-white text-[#003DA5] font-black text-lg px-2 py-0.5 rounded tracking-widest select-none">PEGANDO HISTORIA</span>
              <span className="hidden sm:inline text-sm text-blue-200">Stock</span>
            </div>
            <a href="/login" className="text-xs text-blue-200 hover:text-white transition-colors">
              Administración →
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 mt-16 py-6 text-center text-sm text-gray-400 space-y-2">
        {contactos.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {contactos.map((c) => (
              <a
                key={c.href}
                href={c.href}
                target={c.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-[#003DA5]"
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
        <p><span className="font-bold text-[#003DA5]">PANINI</span> Stock &copy; {new Date().getFullYear()}</p>
      </footer>
      <WhatsAppButton numero={config?.whatsapp ?? null} mensaje={config?.mensaje_whatsapp} />
    </div>
  )
}
