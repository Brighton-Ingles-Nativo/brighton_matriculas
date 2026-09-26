import { assertCsrf, getClientIPAddress, getUserBySession } from '../../../utils/auth'
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
    select: { id: true, userId: true, status: true, accepted: true }
  })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  if (user.role?.name === 'asesor' && contract.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta matrícula' })
  }
  if (Number(contract.status) !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'El contrato debe estar revisado antes de aceptarlo' })
  }
  if (contract.accepted) return { success: true, message: 'El contrato ya fue aceptado' }

  await prisma.contract.update({
    where: { id },
    data: { accepted: true, acceptedAt: new Date(), acceptedIp: getClientIPAddress(event) }
  })

  return { success: true, message: 'Contrato aceptado digitalmente' }
})
