import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Sede inválida.' })
  const name = body.name === undefined ? undefined : String(body.name).trim()
  if (name !== undefined && !name) throw createError({ statusCode: 400, statusMessage: 'El nombre de la sede es obligatorio.' })
  const hasSupervisors = Array.isArray(body.supervisorIds)
  const ids = hasSupervisors ? [...new Set((body.supervisorIds as unknown[]).map(String).filter(Boolean))] : []
  if (hasSupervisors && ids.length) {
    const valid = await prisma.user.count({ where: { id: { in: ids }, active: true, role: { name: 'supervisor' } } })
    if (valid !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más supervisores no son válidos.' })
  }
  try {
    const site = await prisma.$transaction(async (tx) => {
      const updated = await tx.site.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(body.active !== undefined ? { active: Boolean(body.active) } : {}) } })
      if (hasSupervisors) {
        await tx.siteSupervisor.deleteMany({ where: { siteId: id } })
        if (ids.length) await tx.siteSupervisor.createMany({ data: ids.map((supervisorId) => ({ siteId: id, supervisorId })), skipDuplicates: true })
      }
      return updated
    })
    return { success: true, data: site }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe una sede con ese nombre.' })
    throw error
  }
})
