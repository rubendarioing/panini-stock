// Lista los perfiles existentes (id, email, nombre, rol) para depurar
// discrepancias de email al usar reset-password.mjs.
// Uso: node scripts/list-profiles.mjs

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('.env.local', 'utf8')
function getEnv(name) {
  const m = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return m?.[1]?.trim()
}

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !serviceKey) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const { data: profiles, error } = await supabase
  .from('profiles')
  .select('id, email, nombre, rol, activo')

if (error) {
  console.error('Error al listar perfiles:', error.message)
  process.exit(1)
}

if (!profiles?.length) {
  console.log('No hay filas en profiles. El problema probablemente es SUPABASE_SERVICE_ROLE_KEY (proyecto equivocado o llave inválida).')
} else {
  console.table(profiles)
}
