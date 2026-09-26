import { requireAdmin, parsePermissions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const users = await prisma.user.findMany({
    where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { role: true, _count: { select: { sessions: true, contracts: true } } }
  })
  return { success: true, data: users.map((user) => ({ id: user.id, name: user.name, username: user.username, email: user.email, active: user.active, emailVerified: user.emailVerified, createdAt: user.createdAt, updatedAt: user.updatedAt, role: { id: user.role.id, name: user.role.name, permissions: parsePermissions(user.role.permissions) }, sessionCount: user._count.sessions, contractCount: user._count.contracts })) }
})
