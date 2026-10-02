import { getUserBySession } from '../../utils/auth'
import { serializeNotification } from '../../utils/notifications'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const unreadOnly = query.unreadOnly === 'true'

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } })
  ])

  return { success: true, data: items.map(serializeNotification), unreadCount }
})
