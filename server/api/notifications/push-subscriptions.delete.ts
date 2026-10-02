import { assertCsrf, getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const body = await readBody<{ endpoint?: string }>(event)
  if (!body.endpoint) throw createError({ statusCode: 400, statusMessage: 'Endpoint inválido' })

  await prisma.pushSubscription.updateMany({
    where: { userId: user.id, endpoint: body.endpoint },
    data: { active: false }
  })

  return { success: true }
})
