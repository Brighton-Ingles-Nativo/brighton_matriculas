import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Equipo inválido.' })
  const name = body.name === undefined ? undefined : String(body.name).trim()
  const siteId = body.siteId === undefined ? undefined : String(body.siteId)
  const modality = body.modality === undefined ? undefined : String(body.modality)
  if (name !== undefined && !name) throw createError({ statusCode: 400, statusMessage: 'El nombre del equipo es obligatorio.' })
  if (modality !== undefined && !['PRESENCIAL', 'VIRTUAL'].includes(modality)) throw createError({ statusCode: 400, statusMessage: 'La modalidad no es válida.' })
  const hasSupervisors = Array.isArray(body.supervisorIds)
  const ids = hasSupervisors ? [...new Set((body.supervisorIds as unknown[]).map(String).filter(Boolean))] : []
  const hasMembers = Array.isArray(body.memberIds)
  const memberIds = hasMembers ? [...new Set((body.memberIds as unknown[]).map(String).filter(Boolean))] : []
  const [site, valid] = await Promise.all([
    siteId ? prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }) : Promise.resolve(true),
    hasSupervisors ? prisma.user.count({ where: { id: { in: ids }, active: true, role: { name: 'supervisor' } } }) : Promise.resolve(0),
  ])
  if (!site) throw createError({ statusCode: 400, statusMessage: 'La sede seleccionada no existe.' })
  if (valid !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más supervisores no son válidos.' })
  const validMembers = hasMembers ? await prisma.user.count({ where: { id: { in: memberIds }, active: true } }) : 0
  if (hasMembers && validMembers !== memberIds.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más miembros no son válidos.' })
  try {
    const team = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(siteId !== undefined ? { siteId } : {}), ...(modality !== undefined ? { modality: modality as 'PRESENCIAL' | 'VIRTUAL' } : {}), ...(body.active !== undefined ? { active: Boolean(body.active) } : {}) } })
      if (hasSupervisors) {
        await tx.teamSupervisor.deleteMany({ where: { teamId: id } })
        if (ids.length) await tx.teamSupervisor.createMany({ data: ids.map((supervisorId) => ({ teamId: id, supervisorId })), skipDuplicates: true })
      }
      if (hasMembers) {
        await tx.teamMember.deleteMany({ where: { teamId: id } })
        if (memberIds.length) await tx.teamMember.createMany({ data: memberIds.map((userId) => ({ teamId: id, userId })), skipDuplicates: true })
      }
      return updated
    })
    return { success: true, data: team }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe un equipo con ese nombre.' })
    throw error
  }
})
