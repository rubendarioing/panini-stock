'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Package,
  ShoppingCart,
  Gift,
  Users,
  LogOut,
  Store,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile } from '@/lib/types'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/collections', label: 'Álbumes', icon: BookOpen },
  { href: '/collections/stickers', label: 'Catálogo láminas', icon: Layers },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart },
  { href: '/combos', label: 'Combos', icon: Gift },
  { href: '/store', label: 'Ver tienda', icon: Store, external: true },
]

const adminItems = [
  { href: '/users', label: 'Usuarios', icon: Users },
]

interface SidebarProps {
  profile: Profile
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <span className="text-xl font-bold text-blue-400">Panini Stock</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, external }: any) => (
          <Link
            key={href}
            href={href}
            target={external ? '_blank' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}

        {profile.rol === 'admin' && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Administración
              </p>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-white">{profile.nombre}</p>
          <p className="text-xs text-gray-400">{profile.email}</p>
          <span className="mt-1 inline-block rounded-full bg-blue-900 px-2 py-0.5 text-xs text-blue-300">
            {profile.rol}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
