import { requireAdmin, parsePermissions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } })
  return { success: true, data: roles.map((role) => ({ id: role.id, name: role.name, permissions: parsePermissions(role.permissions), userCount: role._count.users })) }
})
