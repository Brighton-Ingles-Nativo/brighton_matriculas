import { getClientIPAddress } from '../../../../utils/auth'
import { notify } from '../../../../utils/notifications'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getQuery(event).token
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Enlace público inválido' })
  }

  const contract = await prisma.contract.findFirst({
    where: { id, accessToken: token, tokenExpiresAt: { gt: new Date() } },
    select: { id: true, status: true, signedAt: true, userId: true, user: { select: { supervisorId: true } } }
  })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'El enlace ha expirado o no es válido' })
  if (contract.status !== 'REVISION') throw createError({ statusCode: 409, statusMessage: 'El contrato debe estar en revisión antes de firmarlo' })
  if (contract.signedAt) return { success: true, message: 'El contrato ya fue firmado' }

  const signed = await prisma.contract.update({ where: { id }, data: { status: 'FIRMADO', signedAt: new Date(), signedIp: getClientIPAddress(event) } })
  await notify({
    recipients: [contract.userId, contract.user.supervisorId ?? ''],
    type: 'CONTRATO_FIRMADO',
    title: 'Contrato firmado',
    message: 'El cliente firmó el contrato y el expediente puede ser generado.',
    entityType: 'CONTRACT',
    entityId: contract.id,
    actionUrl: `/matricula/${contract.id}`,
    priority: 'high',
    dedupeKey: `contract:${contract.id}:signed`
  })
  return { success: true, message: 'Contrato aceptado digitalmente', data: { status: signed.status, signedAt: signed.signedAt, signedIp: signed.signedIp } }
})
