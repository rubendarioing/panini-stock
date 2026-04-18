import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user!.id)
    .single()

  if (currentProfile?.rol !== 'admin') redirect('/')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return <UsersClient profiles={profiles ?? []} currentUserId={user!.id} />
}
