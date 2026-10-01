import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

async function validSupervisorIds(value: unknown): Promise<string[]> {
  const ids = Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : []
  if (!ids.length) return []
  const valid = await prisma.user.count({ where: { id: { in: ids }, active: true, role: { name: 'supervisor' } } })
  if (valid !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más supervisores no son válidos.' })
  return ids
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const body = await readBody<Record<string, unknown>>(event)
  const name = String(body.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre de la sede es obligatorio.' })
  const ids = await validSupervisorIds(body.supervisorIds)
  try {
    const site = await prisma.site.create({ data: { name, active: body.active !== false, supervisors: { create: ids.map((supervisorId) => ({ supervisorId })) } } })
    return { success: true, data: site }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe una sede con ese nombre.' })
    throw error
  }
})
