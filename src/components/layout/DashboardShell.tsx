'use client'

import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { Profile } from '@/lib/types'

export default function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — desktop: empuja contenido | móvil: overlay */}
      <div
        className={[
          'flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
          isMobile
            ? 'fixed inset-y-0 left-0 z-50 ' + (open ? 'w-64' : 'w-0')
            : open ? 'w-64' : 'w-0',
        ].join(' ')}
      >
        <div className="w-64 h-full">
          <Sidebar profile={profile} onClose={() => setOpen(false)} />
        </div>
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        {/* Barra superior con toggle */}
        <div className="sticky top-0 z-30 bg-gray-50 border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            title={open ? 'Cerrar menú' : 'Abrir menú'}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-gray-500 select-none hidden sm:inline">Panini Stock</span>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
