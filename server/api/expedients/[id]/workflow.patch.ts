import { assertCsrf } from '../../../utils/auth'
import { assertContractAccess, supervisorRecipientIds } from '../../../utils/contract-access'
import { notify } from '../../../utils/notifications'
import { requireExpedientUser } from '../../../utils/expedients'
import { prisma } from '../../../utils/prisma'

const ACTIONS = [
  'send_supervisor',
  'approve_supervisor',
  'reject_supervisor',
  'send_verification',
  'reject_commercial',
  'reject_verification',
  'schedule_appointment',
  'verify_with_observations',
  'verify'
] as const

type WorkflowAction = typeof ACTIONS[number]
type ReturnLocation = 'ASISTENTE_COMERCIAL' | 'SUPERVISOR'

const REJECTION_ACTIONS: WorkflowAction[] = ['reject_supervisor', 'reject_commercial', 'reject_verification', 'verify_with_observations']

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })

  const body = await readBody<{
    action?: WorkflowAction
    observation?: string
    appointmentAt?: string
    appointmentType?: string
    advisoryRating?: number
    returnTo?: ReturnLocation
  }>(event)
  if (!body.action || !ACTIONS.includes(body.action)) throw createError({ statusCode: 400, statusMessage: 'Acción de expediente inválida' })

  const action = body.action
  const observation = String(body.observation || '').trim()
  const role = user.role?.name
  const expedient = await prisma.expedient.findUnique({
    where: { id },
    include: {
      contract: { select: { id: true, contractNumber: true, userId: true, user: { select: { supervisorId: true } } } },
      documents: { select: { type: true } }
    }
  })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  await assertContractAccess(user, expedient.contractId)

  const isAdvisor = role === 'asesor'
  const isSupervisor = role === 'supervisor'
  const isReviewer = role === 'admin' || role === 'verificador'
  const isCommercial = role === 'admin' || role === 'asistente_comercial'

  if (action === 'send_supervisor' && !isAdvisor) throw createError({ statusCode: 403, statusMessage: 'Solo el asesor puede reenviar el expediente al supervisor.' })
  if (['approve_supervisor', 'reject_supervisor'].includes(action) && !(isSupervisor || role === 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Solo el supervisor puede revisar este expediente.' })
  }
  if (action === 'send_verification' && !isCommercial) throw createError({ statusCode: 403, statusMessage: 'Solo Comercial puede enviar a verificación.' })
  if (['reject_verification', 'schedule_appointment', 'verify_with_observations', 'verify'].includes(action) && !isReviewer) {
    throw createError({ statusCode: 403, statusMessage: 'Solo Verificación puede realizar esta acción.' })
  }
  if (action === 'reject_commercial' && !isCommercial) throw createError({ statusCode: 403, statusMessage: 'Solo Comercial puede rebotar este expediente.' })
  if (REJECTION_ACTIONS.includes(action) && !observation) throw createError({ statusCode: 400, statusMessage: 'La observación es obligatoria.' })

  const expectedLocations: Partial<Record<WorkflowAction, string[]>> = {
    send_supervisor: ['ASESOR'],
    approve_supervisor: ['SUPERVISOR'],
    reject_supervisor: ['SUPERVISOR'],
    send_verification: ['ASISTENTE_COMERCIAL'],
    reject_commercial: ['ASISTENTE_COMERCIAL'],
    reject_verification: ['VERIFICACION'],
    schedule_appointment: ['VERIFICACION'],
    verify_with_observations: ['VERIFICACION'],
    verify: ['VERIFICACION']
  }
  if (!expectedLocations[action]?.includes(expedient.currentLocation)) {
    throw createError({ statusCode: 409, statusMessage: 'Esta acción no está disponible en la etapa actual del expediente.' })
  }
  if (['approve_supervisor', 'send_verification'].includes(action)) {
    const documentTypes = new Set(expedient.documents.map((document) => document.type))
    if (!documentTypes.has('DNI') || !documentTypes.has('VOUCHER')) {
      throw createError({ statusCode: 409, statusMessage: 'El expediente debe incluir el DNI y el voucher antes de continuar.' })
    }
  }

  const appointmentAt = body.appointmentAt ? new Date(body.appointmentAt) : null
  if (action === 'schedule_appointment' && (!appointmentAt || Number.isNaN(appointmentAt.getTime()))) {
    throw createError({ statusCode: 400, statusMessage: 'La fecha de cita es obligatoria.' })
  }
  if (action === 'schedule_appointment' && !['PRESENCIAL', 'VIRTUAL'].includes(body.appointmentType || '')) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona un tipo de cita válido.' })
  }
  if ((action === 'verify' || action === 'verify_with_observations') && body.advisoryRating !== undefined && body.advisoryRating !== null && (!Number.isInteger(body.advisoryRating) || body.advisoryRating < 0 || body.advisoryRating > 10)) {
    throw createError({ statusCode: 400, statusMessage: 'La calificación de asesoría debe ser un entero de 0 a 10.' })
  }

  const returnTo: ReturnLocation = body.returnTo === 'SUPERVISOR' ? 'SUPERVISOR' : 'ASISTENTE_COMERCIAL'
  const statusByAction = {
    send_supervisor: 'CREADO',
    approve_supervisor: 'CREADO',
    reject_supervisor: 'REBOTADO',
    send_verification: 'CREADO',
    reject_commercial: 'REBOTADO',
    reject_verification: 'REBOTADO',
    schedule_appointment: 'AGENDADO',
    verify_with_observations: 'OBSERVADO',
    verify: 'VERIFICADO'
  } as const
  const locationByAction = {
    send_supervisor: 'SUPERVISOR',
    approve_supervisor: 'ASISTENTE_COMERCIAL',
    reject_supervisor: 'ASESOR',
    send_verification: 'VERIFICACION',
    reject_commercial: 'ASESOR',
    reject_verification: returnTo,
    schedule_appointment: 'VERIFICACION',
    verify_with_observations: 'VERIFICACION',
    verify: 'VERIFICACION'
  } as const
  const status = statusByAction[action]
  const location = locationByAction[action]

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.expedient.update({
      where: { id },
      data: {
        status,
        currentLocation: location,
        ...(action === 'approve_supervisor' ? { sentToCommercialAt: new Date() } : {}),
        ...(action === 'send_verification' ? { sentToVerificationAt: new Date() } : {}),
        ...(REJECTION_ACTIONS.includes(action) ? { observation, observationAt: new Date(), observationById: user.id } : {}),
        ...(action === 'schedule_appointment' ? { appointmentAt, appointmentType: body.appointmentType || null } : {}),
        ...(action === 'verify' || action === 'verify_with_observations' ? { verifiedAt: new Date(), ...(body.advisoryRating !== undefined ? { advisoryRating: body.advisoryRating } : {}) } : {})
      }
    })
    await tx.expedientMovement.create({
      data: {
        expedientId: id,
        fromStatus: expedient.status,
        toStatus: result.status,
        fromLocation: expedient.currentLocation,
        toLocation: result.currentLocation,
        userId: user.id,
        observation: observation || null
      }
    })
    return result
  })

  const supervisorRecipients = await supervisorRecipientIds(expedient.contract.userId)
  const commercialUsers = async () => (await prisma.user.findMany({ where: { active: true, role: { name: 'asistente_comercial' } }, select: { id: true } })).map((item) => item.id)
  const verifierUsers = async () => (await prisma.user.findMany({ where: { active: true, role: { name: 'verificador' } }, select: { id: true } })).map((item) => item.id)
  let recipients: string[] = []
  if (action === 'send_supervisor') recipients = supervisorRecipients
  if (action === 'approve_supervisor') recipients = await commercialUsers()
  if (action === 'reject_supervisor' || action === 'reject_commercial') recipients = [expedient.contract.userId, ...supervisorRecipients]
  if (action === 'send_verification') recipients = await verifierUsers()
  if (action === 'reject_verification') {
    recipients = returnTo === 'SUPERVISOR'
      ? supervisorRecipients
      : await commercialUsers()
  }
  if (['schedule_appointment', 'verify_with_observations', 'verify'].includes(action)) {
    recipients = [expedient.contract.userId, ...supervisorRecipients, ...(await commercialUsers())]
  }

  const titles: Record<WorkflowAction, string> = {
    send_supervisor: 'Expediente reenviado al supervisor',
    approve_supervisor: 'Expediente enviado a Comercial',
    reject_supervisor: 'Expediente rebotado por Supervisor',
    send_verification: 'Expediente enviado a Verificación',
    reject_commercial: 'Expediente rebotado por Comercial',
    reject_verification: 'Expediente rebotado por Verificación',
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
    priority: REJECTION_ACTIONS.includes(action) ? 'high' : 'normal',
    data: { status, currentLocation: location, observation, appointmentAt: updated.appointmentAt, appointmentType: updated.appointmentType },
    dedupeKey: `expedient:${updated.id}:workflow:${updated.updatedAt.toISOString()}`
  })

  return { success: true, data: { id: updated.id, status: updated.status, currentLocation: updated.currentLocation, observation: updated.observation } }
})
