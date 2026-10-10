import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { assertContractAccess } from '../../../utils/contract-access'
import { notify } from '../../../utils/notifications'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (!['asesor', 'supervisor', 'admin'].includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para solicitar la anulación' })
  const contractId = getRouterParam(event, 'id')
  const body = await readBody<{ reason?: string }>(event)
  const reason = String(body.reason || '').trim()
  if (!contractId || !reason) throw createError({ statusCode: 400, statusMessage: 'El motivo de anulación es obligatorio' })

  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true, contractNumber: true, userId: true, user: { select: { supervisorId: true } } } })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  await assertContractAccess(user, contractId)
  const admins = await prisma.user.findMany({ where: { active: true, role: { name: 'admin' } }, select: { id: true } })
  const recipients = [contract.user.supervisorId ?? '', ...admins.map((item) => item.id)]
  const request = await prisma.cancellationRequest.upsert({
    where: { contractId },
    create: { contractId, requestedById: user.id, reason, status: 'PENDIENTE' },
    update: { requestedById: user.id, reason, status: 'PENDIENTE', reviewedById: null, reviewedAt: null, reviewNote: null }
  })
  await notify({ recipients, type: 'SOLICITUD_ANULACION', title: 'Solicitud de anulación', message: `La matrícula ${contract.contractNumber} solicita anulación: ${reason}`, entityType: 'CONTRACT', entityId: contract.id, actionUrl: `/matricula/${contract.id}`, priority: 'high', dedupeKey: `cancellation:${request.id}:${request.createdAt.toISOString()}` })
  return { success: true, data: { id: request.id, status: request.status } }
})
