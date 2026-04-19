import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tienda — Panini Stock',
  description: 'Catálogo de álbumes y láminas Panini',
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  )
}
