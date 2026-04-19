import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tienda — Pegando Historia Stock',
  description: 'Catálogo de álbumes y láminas Panini',
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 mt-16 py-6 text-center text-sm text-gray-400">
        <span className="font-bold text-[#003DA5]">PANINI</span> Stock &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
