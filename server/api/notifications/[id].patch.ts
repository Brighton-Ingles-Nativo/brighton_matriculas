import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { publishToUser } from '../../utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Notificación inválida' })

  const readAt = new Date()
  const notification = await prisma.notification.updateMany({
    where: { id, recipientId: user.id },
    data: { readAt }
  })
  if (!notification.count) throw createError({ statusCode: 404, statusMessage: 'Notificación no encontrada' })

  publishToUser(user.id, {
    id,
    type: 'notification.read',
    recipientId: user.id,
    payload: { id, readAt: readAt.toISOString() },
    occurredAt: readAt.toISOString()
  })

  return { success: true }
})
