import { requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sessions = await prisma.userSession.findMany({ where: { expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' }, include: { user: { select: { id: true, name: true, username: true, email: true } } } })
  return { success: true, data: sessions.map((session) => ({ id: session.id, user: session.user, ipAddress: session.ipAddress, userAgent: session.userAgent, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt, expiresAt: session.expiresAt, rememberMe: session.rememberMe })) }
})
