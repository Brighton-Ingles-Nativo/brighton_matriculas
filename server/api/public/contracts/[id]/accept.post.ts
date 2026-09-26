import { getClientIPAddress } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getQuery(event).token
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Enlace público inválido' })
  }

  const contract = await prisma.contract.findFirst({
    where: { id, accessToken: token, tokenExpiresAt: { gt: new Date() } },
    select: { id: true, status: true, accepted: true }
  })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'El enlace ha expirado o no es válido' })
  if (Number(contract.status) !== 1) throw createError({ statusCode: 409, statusMessage: 'El contrato debe estar revisado antes de aceptarlo' })
  if (contract.accepted) return { success: true, message: 'El contrato ya fue aceptado' }

  await prisma.contract.update({ where: { id }, data: { accepted: true, acceptedAt: new Date(), acceptedIp: getClientIPAddress(event) } })
  return { success: true, message: 'Contrato aceptado digitalmente' }
})
