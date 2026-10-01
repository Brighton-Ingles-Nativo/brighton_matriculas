import { getUserBySession } from '../../utils/auth'
import { LookupService } from '../../utils/ruc-search'

const normalizeDate = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (!match) return raw
  const [, day = '', month = '', year = ''] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  }

  const dni = String(getRouterParam(event, 'dni') || '').trim()
  if (!/^\d{8}$/.test(dni)) {
    throw createError({ statusCode: 400, statusMessage: 'El DNI debe contener 8 dígitos.' })
  }

  try {
    const data = await new LookupService().getDni(dni)
    return { success: true, data: { ...data, fechaNacimiento: normalizeDate(data.fechaNacimiento) } }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'No se encontraron datos para el DNI.' })
  }
})
