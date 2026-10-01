import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const teams = await prisma.team.findMany({ where: { active: true, site: { active: true } }, orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }], include: { site: { select: { id: true, name: true } } } })
  return { success: true, data: teams.map((team) => ({ id: team.id, name: team.name, modality: team.modality, site: team.site })) }
})
