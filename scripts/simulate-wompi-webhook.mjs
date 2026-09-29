// Simula un evento `transaction.updated` de Wompi, firmado con el
// WOMPI_EVENTS_SECRET real de .env.local, para probar api/webhooks/wompi
// sin depender de ngrok ni de una transacción real en Wompi.
//
// Uso:
//   node scripts/simulate-wompi-webhook.mjs <sale_id> [APPROVED|DECLINED|VOIDED|ERROR]
//
// Requiere que <sale_id> exista en `sales` con estado = 'pendiente' para ver
// el efecto (cambio de estado + reposición de inventario si se declina).

import { readFileSync } from 'fs'
import { createHash } from 'crypto'

const envFile = readFileSync('.env.local', 'utf8')
const match = envFile.match(/^WOMPI_EVENTS_SECRET=(.*)$/m)
if (!match) {
  console.error('No se encontró WOMPI_EVENTS_SECRET en .env.local')
  process.exit(1)
}
const secret = match[1].trim()

const [, , saleId, status = 'APPROVED'] = process.argv
if (!saleId) {
  console.error('Uso: node scripts/simulate-wompi-webhook.mjs <sale_id> [APPROVED|DECLINED|VOIDED|ERROR]')
  process.exit(1)
}

const timestamp = Math.floor(Date.now() / 1000)
const data = {
  transaction: {
    id: 'test-tx-' + Date.now(),
    status,
    reference: String(saleId),
    amount_in_cents: 1000000,
  },
}

const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
const getByPath = (obj, path) => path.split('.').reduce((acc, k) => acc?.[k], obj)
const concatenated = properties.map((p) => String(getByPath(data, p))).join('')
const checksum = createHash('sha256').update(concatenated + timestamp + secret).digest('hex')

const payload = {
  event: 'transaction.updated',
  data,
  environment: 'test',
  signature: { properties, checksum },
  timestamp,
  sent_at: new Date().toISOString(),
}

process.stdout.write(JSON.stringify(payload))
