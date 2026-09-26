import { requireAdmin, assertCsrf } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID de sesión requerido' })
  await prisma.userSession.deleteMany({ where: { id } })
  return { success: true }
})
