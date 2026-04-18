import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tienda — Panini Stock',
  description: 'Catálogo de álbumes y láminas Panini',
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-blue-600">Panini Stock</span>
              <span className="hidden sm:inline text-sm text-gray-400">| Tienda oficial</span>
            </div>
            <a
              href="/login"
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              Acceso administración →
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-sm text-gray-400">
        Panini Stock © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
