import { createClient } from '@/lib/supabase/server'
import CollectionsClient from './CollectionsClient'

export default async function CollectionsPage() {
  const supabase = await createClient()

  const [{ data: albums }, { data: collectionTypes }, { data: { user } }] = await Promise.all([
    supabase
      .from('albums')
      .select('*, collection_types(nombre)')
      .order('anio', { ascending: false }),
    supabase.from('collection_types').select('*').order('nombre'),
    supabase.auth.getUser(),
  ])

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user!.id).single()

  return (
    <CollectionsClient
      albums={albums ?? []}
      collectionTypes={collectionTypes ?? []}
      isAdmin={profile?.rol === 'admin'}
    />
  )
}
