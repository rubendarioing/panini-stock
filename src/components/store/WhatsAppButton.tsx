import { MessageCircle } from 'lucide-react'

// Número en formato internacional sin "+" (ej. 573001234567), configurado en
// NEXT_PUBLIC_WHATSAPP_NUMBER. Si no está configurado, el botón no se muestra.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '') ?? ''

export function getWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

// A la izquierda: la esquina inferior derecha la usa el botón flotante del carrito.
export function WhatsAppButton() {
  if (!WHATSAPP_NUMBER) return null
  return (
    <a
      href={getWhatsAppUrl('Hola, quiero información sobre los álbumes y láminas de la tienda.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar por WhatsApp"
      className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:bg-green-700"
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </a>
  )
}
