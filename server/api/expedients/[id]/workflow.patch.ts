import { assertCsrf } from '../../../utils/auth'
import { notify } from '../../../utils/notifications'
import { requireExpedientUser } from '../../../utils/expedients'
import { prisma } from '../../../utils/prisma'

const ACTIONS = ['send_verification', 'reject_commercial', 'reject_verification', 'schedule_appointment', 'verify_with_observations', 'verify'] as const
type WorkflowAction = typeof ACTIONS[number]

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })

  const body = await readBody<{ action?: WorkflowAction; observation?: string; appointmentAt?: string; appointmentType?: string; advisoryRating?: number }>(event)
  if (!body.action || !ACTIONS.includes(body.action)) throw createError({ statusCode: 400, statusMessage: 'Acción de expediente inválida' })
  const action = body.action
  const observation = String(body.observation || '').trim()
  const role = user.role?.name

  const expedient = await prisma.expedient.findUnique({
    where: { id },
    include: { contract: { select: { id: true, contractNumber: true, userId: true, user: { select: { supervisorId: true } } } } }
  })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  if (role === 'asesor' && expedient.contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este expediente' })

  const isReviewer = role === 'admin' || role === 'verificador'
  const isCommercial = role === 'admin' || role === 'asistente_comercial'
  if (action === 'send_verification' && !isCommercial) throw createError({ statusCode: 403, statusMessage: 'Solo el asistente comercial puede enviar a verificación' })
  if (['reject_verification', 'schedule_appointment', 'verify_with_observations', 'verify'].includes(action) && !isReviewer) {
    throw createError({ statusCode: 403, statusMessage: 'Solo verificación puede realizar esta acción' })
  }
  if (action === 'reject_commercial' && !isCommercial) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para rebotar este expediente' })
  if (['reject_commercial', 'reject_verification', 'verify_with_observations'].includes(action) && !observation) {
    throw createError({ statusCode: 400, statusMessage: 'La observación es obligatoria' })
  }

  const appointmentAt = body.appointmentAt ? new Date(body.appointmentAt) : null
  if (action === 'schedule_appointment' && (!appointmentAt || Number.isNaN(appointmentAt.getTime()))) {
    throw createError({ statusCode: 400, statusMessage: 'La fecha de cita es obligatoria' })
  }

  const statusByAction: Record<WorkflowAction, string> = {
    send_verification: 'EN_VERIFICACION',
    reject_commercial: 'REBOTADO_COMERCIAL',
    reject_verification: 'REBOTADO_VERIFICACION',
    schedule_appointment: 'CITA_PROGRAMADA',
    verify_with_observations: 'VERIFICADA_CON_OBSERVACIONES',
    verify: 'VERIFICADA'
  }
  const status = statusByAction[action]
  const updated = await prisma.expedient.update({
    where: { id },
    data: {
      status,
      ...(action === 'send_verification' ? { sentToVerificationAt: new Date() } : {}),
      ...(['reject_commercial', 'reject_verification', 'verify_with_observations'].includes(action) ? { observation, observationAt: new Date(), observationById: user.id } : {}),
      ...(action === 'schedule_appointment' ? { appointmentAt, appointmentType: body.appointmentType || null } : {}),
      ...(action === 'verify' || action === 'verify_with_observations' ? { verifiedAt: new Date(), advisoryRating: Number.isInteger(body.advisoryRating) ? body.advisoryRating : null } : {})
    }
  })

  const recipients = [expedient.contract.userId, expedient.contract.user.supervisorId ?? '']
  if (['reject_verification', 'schedule_appointment', 'verify_with_observations', 'verify'].includes(action)) {
    const commercial = await prisma.user.findMany({ where: { active: true, role: { name: 'asistente_comercial' } }, select: { id: true } })
    recipients.push(...commercial.map((item) => item.id))
  }
  if (action === 'send_verification') {
    const verifiers = await prisma.user.findMany({ where: { active: true, role: { name: 'verificador' } }, select: { id: true } })
    recipients.push(...verifiers.map((item) => item.id))
  }

  const titles: Record<WorkflowAction, string> = {
    send_verification: 'Expediente enviado a verificación',
    reject_commercial: 'Expediente rebotado por comercial',
    reject_verification: 'Expediente rebotado por verificación',
    schedule_appointment: 'Cita de verificación programada',
    verify_with_observations: 'Matrícula verificada con observaciones',
    verify: 'Matrícula verificada'
  }
  await notify({
    recipients,
    type: `EXPEDIENTE_${status}`,
    title: titles[action],
    message: observation || `El expediente ${expedient.contract.contractNumber} cambió al estado ${status}.`,
    entityType: 'EXPEDIENT',
    entityId: updated.id,
    actionUrl: `/expedientes/${updated.id}`,
    priority: ['reject_commercial', 'reject_verification'].includes(action) ? 'high' : 'normal',
    data: { status, observation, appointmentAt: updated.appointmentAt, appointmentType: updated.appointmentType },
    dedupeKey: `expedient:${updated.id}:workflow:${updated.updatedAt.toISOString()}`
  })

  return { success: true, data: { id: updated.id, status: updated.status, observation: updated.observation } }
})
