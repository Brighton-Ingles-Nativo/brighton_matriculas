import { spawn } from 'node:child_process'

export type EmailAddress = string

export interface SendEmailInput {
  to: EmailAddress | EmailAddress[]
  subject: string
  html?: string
  text?: string
  from?: EmailAddress
  fromName?: string
}

interface MailRuntimeConfig {
  enabled?: boolean
  from?: string
  fromName?: string
}

const SENDMAIL_PATH = '/usr/sbin/sendmail'
const SENDMAIL_TIMEOUT_MS = 15000

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

const encodeHeader = (value: string) => {
  assertHeaderValue(value, 'correo')
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value
}

const formatMailbox = (email: string, name?: string) => {
  assertAddress(email, 'remitente')
  const cleanName = String(name || '').trim()
  if (!cleanName) return email
  assertHeaderValue(cleanName, 'nombre del remitente')
  return `${encodeHeader(cleanName)} <${email}>`
}

const buildMessage = (input: SendEmailInput, config: MailRuntimeConfig) => {
  const recipients = asAddresses(input.to)
  if (!recipients.length) throw createError({ statusCode: 400, statusMessage: 'Debe indicar al menos un destinatario.' })
  recipients.forEach((address) => assertAddress(address, 'destinatario'))

  const subject = String(input.subject || '').trim()
  if (!subject) throw createError({ statusCode: 400, statusMessage: 'El asunto del correo es obligatorio.' })
  assertHeaderValue(subject, 'asunto')

  const html = input.html?.trim() || ''
  const text = input.text?.trim() || ''
  if (!html && !text) throw createError({ statusCode: 400, statusMessage: 'El correo debe incluir contenido HTML o texto.' })

  const from = input.from || config.from || ''
  if (!from) throw createError({ statusCode: 500, statusMessage: 'El remitente del correo no está configurado.' })
  const fromName = input.fromName ?? config.fromName

  const headers = [
    `From: ${formatMailbox(from, fromName)}`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Date: ' + new Date().toUTCString(),
    'X-Mailer: Brighton mailer',
  ]

  if (html && text) {
    const boundary = `=_Brighton_${Date.now()}_${Math.random().toString(16).slice(2)}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    return `${headers.join('\r\n')}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n--${boundary}--\r\n`
  }

  headers.push(`Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`)
  headers.push('Content-Transfer-Encoding: 8bit')
  return `${headers.join('\r\n')}\r\n\r\n${html || text}\r\n`
}

export const isMailEnabled = () => Boolean(useRuntimeConfig().mail?.enabled)

export const sendEmail = async (input: SendEmailInput) => {
  const config = useRuntimeConfig().mail as MailRuntimeConfig
  if (!config.enabled) {
    throw createError({ statusCode: 503, statusMessage: 'El envío de correos no está habilitado.' })
  }

  const message = buildMessage(input, config)

  await new Promise<void>((resolve, reject) => {
    const process = spawn(SENDMAIL_PATH, ['-t', '-i'], { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      process.kill('SIGTERM')
      if (!settled) {
        settled = true
        reject(createError({ statusCode: 504, statusMessage: 'El servidor de correo tardó demasiado en responder.' }))
      }
    }, SENDMAIL_TIMEOUT_MS)

    process.stderr.on('data', (chunk) => { stderr += String(chunk) })
    process.on('error', (error) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      console.error('No se pudo iniciar el transporte nativo de correo:', error)
      reject(createError({ statusCode: 503, statusMessage: 'No se pudo iniciar el servicio de correo del servidor.' }))
    })
    process.on('close', (code) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      if (code === 0) return resolve()
      console.error('El transporte nativo de correo devolvió un error:', { code, stderr: stderr.trim() })
      reject(createError({ statusCode: 502, statusMessage: 'El servidor de correo no pudo aceptar el mensaje.' }))
    })

    process.stdin.end(message)
  })

  return { success: true }
}
