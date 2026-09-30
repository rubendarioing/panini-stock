import { MessageCircle } from 'lucide-react'

// El número y el mensaje vienen de configuracion_tienda (037), editables en
// Administración → Configuración.
export function getWhatsAppUrl(numero: string, message?: string | null) {
  const base = `https://wa.me/${numero.replace(/\D/g, '')}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

// A la izquierda: la esquina inferior derecha la usa el botón flotante del carrito.
export function WhatsAppButton({ numero, mensaje }: { numero: string | null; mensaje?: string | null }) {
  if (!numero) return null
  return (
    <a
      href={getWhatsAppUrl(numero, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar por WhatsApp"
      className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:bg-green-700"
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </a>
  )
}
