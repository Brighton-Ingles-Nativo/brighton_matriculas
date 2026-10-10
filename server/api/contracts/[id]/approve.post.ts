import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  if (!['admin', 'verificador'].includes(user.role?.name || '')) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para aprobar matrículas' })
  }

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, message: 'ID de matrícula inválido' })
  }

  const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true } })
  if (!contract) throw createError({ statusCode: 404, message: 'Matrícula no encontrada' })

  await prisma.contract.update({ where: { id }, data: { status: 'REVISION' } })
  return { success: true, message: 'Matrícula aprobada correctamente' }
})
