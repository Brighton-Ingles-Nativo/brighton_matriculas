import { assertCsrf } from '../../../utils/auth'
import { requireExpedientUser } from '../../../utils/expedients'
import { prisma } from '../../../utils/prisma'

interface VerificationBody {
  firstContactAt?: unknown
  appointmentAt?: unknown
  appointmentRescheduledAt?: unknown
  appointmentType?: unknown
  advisoryRating?: unknown
  strategyConfirmed?: unknown
  strategyObservation?: unknown
  advisorValidationConfirmed?: unknown
  advisorValidationName?: unknown
  classStartDate?: unknown
  paymentDate?: unknown
}

function optionalDateTime(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label} no es una fecha válida.` })
  }
  const day = value.slice(0, 10)
  const calendarDate = new Date(`${day}T00:00:00.000Z`)
  const hour = Number(value.slice(11, 13))
  const minute = Number(value.slice(14, 16))
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== day || hour > 23 || minute > 59) {
    throw createError({ statusCode: 400, statusMessage: `${label} no es una fecha válida.` })
  }
  return date
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label} no es una fecha válida.` })
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw createError({ statusCode: 400, statusMessage: `${label} no es una fecha válida.` })
  }
  return date
}

function optionalBoolean(value: unknown, label: string): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'boolean') throw createError({ statusCode: 400, statusMessage: `${label} debe ser sí o no.` })
  return value
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `${label} no es válido.` })
  const text = value.trim()
  if (text.length > maxLength) throw createError({ statusCode: 400, statusMessage: `${label} excede ${maxLength} caracteres.` })
  return text || null
}

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  if (!['admin', 'verificador'].includes(user.role?.name || '')) {
    throw createError({ statusCode: 403, statusMessage: 'Solo verificación puede registrar estos datos.' })
  }

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })
  const expedient = await prisma.expedient.findUnique({ where: { id }, select: { id: true, currentLocation: true } })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  if (expedient.currentLocation !== 'VERIFICACION') {
    throw createError({ statusCode: 409, statusMessage: 'El expediente debe estar en verificación para registrar estos datos.' })
  }

  const body = await readBody<VerificationBody>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Datos de verificación inválidos.' })
  }

  const firstContactAt = optionalDateTime(body.firstContactAt, 'La fecha de primer contacto')
  const appointmentAt = optionalDateTime(body.appointmentAt, 'La fecha de cita')
  const appointmentRescheduledAt = optionalDateTime(body.appointmentRescheduledAt, 'La fecha de cita reprogramada')
  const appointmentType = body.appointmentType === null || body.appointmentType === undefined || body.appointmentType === '' ? null : body.appointmentType
  if (appointmentType !== null && appointmentType !== 'PRESENCIAL' && appointmentType !== 'VIRTUAL') {
    throw createError({ statusCode: 400, statusMessage: 'El tipo de cita debe ser presencial o virtual.' })
  }
  if ((appointmentAt || appointmentRescheduledAt) && !appointmentType) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona el tipo de cita.' })
  }

  const advisoryRating = body.advisoryRating === null || body.advisoryRating === undefined || body.advisoryRating === '' ? null : body.advisoryRating
  if (advisoryRating !== null && (typeof advisoryRating !== 'number' || !Number.isInteger(advisoryRating) || advisoryRating < 0 || advisoryRating > 10)) {
    throw createError({ statusCode: 400, statusMessage: 'La calificación de asesoría debe ser un entero de 0 a 10.' })
  }

  const strategyConfirmed = optionalBoolean(body.strategyConfirmed, 'La confirmación de estrategia')
  const strategyObservation = optionalText(body.strategyObservation, 'La estrategia indicada por el cliente', 1000)
  if (strategyConfirmed === false && !strategyObservation) {
    throw createError({ statusCode: 400, statusMessage: 'Indica la estrategia mencionada por el cliente.' })
  }
  const advisorValidationConfirmed = optionalBoolean(body.advisorValidationConfirmed, 'La confirmación de asesor')
  const advisorValidationName = optionalText(body.advisorValidationName, 'El nombre del asesor indicado por el cliente', 200)
  if (advisorValidationConfirmed === false && !advisorValidationName) {
    throw createError({ statusCode: 400, statusMessage: 'Indica el asesor mencionado por el cliente.' })
  }

  const updated = await prisma.expedient.update({
    where: { id },
    data: {
      firstContactAt,
      appointmentAt,
      appointmentRescheduledAt,
      appointmentType,
      advisoryRating,
      strategyConfirmed,
      strategyObservation: strategyConfirmed === false ? strategyObservation : null,
      advisorValidationConfirmed,
      advisorValidationName: advisorValidationConfirmed === false ? advisorValidationName : null,
      classStartDate: optionalDate(body.classStartDate, 'La fecha de inicio de clases'),
      paymentDate: optionalDate(body.paymentDate, 'La fecha de pago')
    }
  })

  return { success: true, data: { id: updated.id, updatedAt: updated.updatedAt } }
})
