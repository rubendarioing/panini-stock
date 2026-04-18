import { createClient } from '@/lib/supabase/server'
import CollectionsClient from './CollectionsClient'

export default async function CollectionsPage() {
  const supabase = await createClient()

  const [{ data: collections }, { data: collectionTypes }, { data: albums }, { data: { user } }] = await Promise.all([
    supabase.from('collections').select('*, collection_types(nombre)').order('anio', { ascending: false }),
    supabase.from('collection_types').select('*').order('nombre'),
    supabase.from('albums').select('*').order('nombre'),
    supabase.auth.getUser(),
  ])

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user!.id).single()

  return (
    <CollectionsClient
      collections={collections ?? []}
      collectionTypes={collectionTypes ?? []}
      albums={albums ?? []}
      isAdmin={profile?.rol === 'admin'}
    />
  )
}
