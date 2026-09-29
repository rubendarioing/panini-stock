// Restablece la contraseña de un usuario del dashboard vía la Admin API de
// Supabase (auth.admin.updateUserById), sin depender del flujo de email
// de la consola de Supabase.
//
// Uso: node scripts/reset-password.mjs <email> <nueva_contrasena>

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

const [, , email, newPassword] = process.argv
if (!email || !newPassword) {
  console.error('Uso: node scripts/reset-password.mjs <email> <nueva_contrasena>')
  process.exit(1)
}
if (newPassword.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, email')
  .eq('email', email)
  .maybeSingle()

if (profileError || !profile) {
  console.error('No se encontró un perfil con ese email:', profileError?.message ?? 'sin resultados')
  process.exit(1)
}

const { error } = await supabase.auth.admin.updateUserById(profile.id, { password: newPassword })
if (error) {
  console.error('Error al actualizar la contraseña:', error.message)
  process.exit(1)
}

console.log(`Contraseña actualizada para ${email}. Ya puedes iniciar sesión en /login.`)
