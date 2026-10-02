import { assertCsrf, getUserBySession } from '../../utils/auth'
import { notify } from '../../utils/notifications'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user || !['supervisor', 'admin'].includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'Solo un supervisor puede revisar la solicitud' })
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ decision?: string; reviewNote?: string }>(event)
  if (!id || !['APROBAR', 'RECHAZAR'].includes(body.decision || '')) throw createError({ statusCode: 400, statusMessage: 'Decisión inválida' })
  const request = await prisma.cancellationRequest.findUnique({ where: { id }, include: { contract: { select: { id: true, contractNumber: true, userId: true } } } })
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })
  if (request.status !== 'PENDIENTE') throw createError({ statusCode: 409, statusMessage: 'La solicitud ya fue revisada' })
  const approved = body.decision === 'APROBAR'
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.cancellationRequest.update({ where: { id }, data: { status: approved ? 'APROBADA' : 'RECHAZADA', reviewedById: user.id, reviewedAt: new Date(), reviewNote: String(body.reviewNote || '').trim() || null } })
    if (approved) await tx.contract.update({ where: { id: request.contract.id }, data: { status: '-5' } })
    return result
  })
  await notify({ recipients: [request.contract.userId, request.requestedById], type: approved ? 'ANULACION_APROBADA' : 'ANULACION_RECHAZADA', title: approved ? 'Anulación aprobada' : 'Anulación rechazada', message: approved ? `La matrícula ${request.contract.contractNumber} fue anulada.` : `La solicitud de anulación fue rechazada. ${updated.reviewNote || ''}`, entityType: 'CONTRACT', entityId: request.contract.id, actionUrl: `/matricula/${request.contract.id}`, priority: 'high', dedupeKey: `cancellation:${request.id}:${updated.status}` })
  return { success: true, data: { status: updated.status } }
})
