import type { Prisma } from '@prisma/client'
import { requireAdmin, assertCsrf, parsePermissions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const id = getRouterParam(event, 'id'); const body = await readBody<{ permissions?: Record<string, boolean> }>(event)
  if (!id || !body.permissions) throw createError({ statusCode: 400, statusMessage: 'Permisos inválidos.' })
  const permissions = Object.fromEntries(Object.entries(body.permissions).filter(([, value]) => typeof value === 'boolean'))
  const role = await prisma.role.update({ where: { id }, data: { permissions: permissions as Prisma.InputJsonValue } })
  return { success: true, data: { id: role.id, name: role.name, permissions: parsePermissions(role.permissions) } }
})
