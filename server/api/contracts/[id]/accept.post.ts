import { assertCsrf, getClientIPAddress, getUserBySession } from '../../../utils/auth'
import { assertContractAccess } from '../../../utils/contract-access'
import { notify } from '../../../utils/notifications'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'ID de matrícula inválido' })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, signedAt: true, user: { select: { supervisorId: true } } }
  })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  await assertContractAccess(user, id)
  if (contract.status !== 'REVISION') {
    throw createError({ statusCode: 409, statusMessage: 'El contrato debe estar en revisión antes de firmarlo' })
  }
  if (contract.signedAt) return { success: true, message: 'El contrato ya fue firmado' }

  const signed = await prisma.contract.update({
    where: { id },
    data: { status: 'FIRMADO', signedAt: new Date(), signedIp: getClientIPAddress(event) }
  })
  await notify({
    recipients: [contract.userId, contract.user.supervisorId ?? ''],
    type: 'CONTRATO_FIRMADO',
    title: 'Contrato firmado',
    message: 'El contrato fue marcado como firmado y el expediente puede ser generado.',
    entityType: 'CONTRACT',
    entityId: contract.id,
    actionUrl: `/matricula/${contract.id}`,
    priority: 'high',
    dedupeKey: `contract:${contract.id}:signed`
  })

  return { success: true, message: 'Contrato aceptado digitalmente', data: { status: signed.status, signedAt: signed.signedAt, signedIp: signed.signedIp } }
})
