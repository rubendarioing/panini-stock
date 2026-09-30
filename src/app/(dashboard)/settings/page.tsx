import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user!.id)
    .single()

  if (currentProfile?.rol !== 'admin') redirect('/')

  const { data: config } = await supabase
    .from('configuracion_tienda')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  return <SettingsClient config={config} />
}
