import { assertCsrf, getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const body = await readBody<{ endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }>(event)
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    throw createError({ statusCode: 400, statusMessage: 'Suscripción inválida' })
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: user.id, endpoint: body.endpoint } },
    create: { userId: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: body.userAgent, active: true },
    update: { p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: body.userAgent, active: true, lastUsedAt: new Date() }
  })

  return { success: true, data: { id: subscription.id } }
})
