export type EmailAddress = string

export interface SendEmailInput {
  to: EmailAddress | EmailAddress[]
  subject: string
  html?: string
  text?: string
  name?: string
  email?: EmailAddress
  phone?: string
}

interface MailRuntimeConfig {
  enabled?: boolean
  fromName?: string
  providerUrl?: string
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

const asAddresses = (value: EmailAddress | EmailAddress[]) => {
  const addresses = Array.isArray(value) ? value : [value]
  return addresses.map((address) => String(address).trim().toLowerCase()).filter(Boolean)
}

const assertAddress = (address: string, field: string) => {
  if (!EMAIL_PATTERN.test(address)) {
    throw createError({ statusCode: 400, statusMessage: `La dirección de correo en ${field} no es válida.` })
  }
}

const assertHeaderValue = (value: string, field: string) => {
  if (/[\r\n]/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `El campo ${field} contiene caracteres no permitidos.` })
  }
}

export const isMailEnabled = () => Boolean(useRuntimeConfig().mail?.enabled)

export const sendEmail = async (input: SendEmailInput) => {
  const config = useRuntimeConfig().mail as MailRuntimeConfig
  if (!config.enabled) {
    throw createError({ statusCode: 503, statusMessage: 'El envío de correos no está habilitado.' })
  }
  if (!config.providerUrl) {
    throw createError({ statusCode: 503, statusMessage: 'El servicio AWS de correo no está configurado.' })
  }

  const recipients = asAddresses(input.to)
  if (!recipients.length) throw createError({ statusCode: 400, statusMessage: 'Debe indicar al menos un destinatario.' })
  recipients.forEach((address) => assertAddress(address, 'destinatario'))

  const subject = String(input.subject || '').trim()
  if (!subject) throw createError({ statusCode: 400, statusMessage: 'El asunto del correo es obligatorio.' })
  assertHeaderValue(subject, 'asunto')

  const message = input.text?.trim() || input.html?.trim() || ''
  if (!message) throw createError({ statusCode: 400, statusMessage: 'El correo debe incluir contenido.' })

  let response: Response
  try {
    response = await fetch(config.providerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        message,
        to: recipients[0],
        name: input.name || config.fromName || 'Brighton Inglés Nativo',
        email: input.email || '',
        phone: input.phone || '',
      }),
    })
  } catch (error) {
    console.error('No se pudo conectar con el motor externo de correo:', error)
    throw createError({ statusCode: 503, statusMessage: 'No se pudo conectar con el servicio de correo.' })
  }

  if (!response.ok) {
    const providerError = await response.text().catch(() => '')
    console.error('El motor externo de correo rechazó el mensaje:', { status: response.status, body: providerError.slice(0, 500) })
    throw createError({ statusCode: 502, statusMessage: 'El servicio de correo rechazó el mensaje.' })
  }

  return { success: true }
}
