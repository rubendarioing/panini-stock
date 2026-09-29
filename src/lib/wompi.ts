import { createHash } from 'crypto'

// SHA256(reference + amountInCents + currency + integration_secret)
// Debe calcularse SIEMPRE en el backend: el integration_secret no puede
// llegar nunca al navegador.
export function getWompiIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string
): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET!
  const raw = `${reference}${amountInCents}${currency}${secret}`
  return createHash('sha256').update(raw).digest('hex')
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: any, key) => acc?.[key], obj)
}

// Verifica el checksum que Wompi manda en cada evento de webhook
// (signature.properties + timestamp + events_secret, hasheado con SHA256).
export function verifyWompiEventChecksum(payload: {
  signature?: { properties?: string[]; checksum?: string }
  timestamp?: number
  data?: unknown
}): boolean {
  const { signature, timestamp, data } = payload
  if (!signature?.properties?.length || !signature?.checksum || timestamp === undefined) {
    return false
  }

  const secret = process.env.WOMPI_EVENTS_SECRET!
  const concatenated = signature.properties.map((p) => String(getByPath(data, p) ?? '')).join('')
  const toHash = `${concatenated}${timestamp}${secret}`
  const computed = createHash('sha256').update(toHash).digest('hex')

  return computed.toLowerCase() === signature.checksum.toLowerCase()
}
