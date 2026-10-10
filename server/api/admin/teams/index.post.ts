import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const body = await readBody<Record<string, unknown>>(event)
  const name = String(body.name || '').trim(); const siteId = String(body.siteId || ''); const modality = String(body.modality || '')
  if (!name || !siteId || !['PRESENCIAL', 'VIRTUAL'].includes(modality)) throw createError({ statusCode: 400, statusMessage: 'Nombre, sede y modalidad son obligatorios.' })
  const ids = Array.isArray(body.supervisorIds) ? [...new Set(body.supervisorIds.map(String).filter(Boolean))] : []
  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds.map(String).filter(Boolean))] : []
  const [site, valid] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
    prisma.user.count({ where: { id: { in: ids }, active: true, role: { name: 'supervisor' } } }),
  ])
  if (!site) throw createError({ statusCode: 400, statusMessage: 'La sede seleccionada no existe.' })
  if (valid !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más supervisores no son válidos.' })
  const validMembers = await prisma.user.count({ where: { id: { in: memberIds }, active: true } })
  if (validMembers !== memberIds.length) throw createError({ statusCode: 400, statusMessage: 'Uno o más miembros no son válidos.' })
  try {
    const team = await prisma.team.create({ data: { name, siteId, modality: modality as 'PRESENCIAL' | 'VIRTUAL', active: body.active !== false, supervisors: { create: ids.map((supervisorId) => ({ supervisorId })) }, members: { create: memberIds.map((userId) => ({ userId })) } }, include: { site: true } })
    return { success: true, data: team }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe un equipo con ese nombre.' })
    throw error
  }
})
