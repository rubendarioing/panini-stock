'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, UserCheck, UserX } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Profile } from '@/lib/types'

export default function UsersClient({ profiles, currentUserId }: { profiles: Profile[]; currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'staff' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Error al crear usuario')
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    setForm({ email: '', nombre: '', password: '', rol: 'staff' })
    router.refresh()
  }

  async function toggleActive(profile: Profile) {
    await supabase.from('profiles').update({ activo: !profile.activo }).eq('id', profile.id)
    router.refresh()
  }

  async function changeRole(id: string, rol: string) {
    await supabase.from('profiles').update({ rol }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">{profiles.length} usuarios registrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nuevo usuario</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Nombre completo</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña inicial</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Creando...' : 'Crear usuario'}</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Creado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{profile.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{profile.email}</td>
                <td className="px-4 py-3">
                  {profile.id === currentUserId ? (
                    <Badge variant="default">admin</Badge>
                  ) : (
                    <Select value={profile.rol} onValueChange={(v) => changeRole(profile.id, v)}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">staff</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={profile.activo ? 'success' : 'secondary'}>
                    {profile.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-400">{formatDate(profile.created_at)}</td>
                <td className="px-4 py-3">
                  {profile.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(profile)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${profile.activo ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                    >
                      {profile.activo ? <><UserX className="h-3.5 w-3.5" /> Desactivar</> : <><UserCheck className="h-3.5 w-3.5" /> Activar</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
