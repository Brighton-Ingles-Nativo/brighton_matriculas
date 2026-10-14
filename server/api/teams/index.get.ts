import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  const teams = await prisma.team.findMany({ where: { active: true, site: { active: true } }, orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }], include: { site: { select: { id: true, name: true } } } })
  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.id, team: { active: true, site: { active: true } } },
    select: { teamId: true }
  })
  const assignedTeamId = memberships.length === 1 ? memberships[0]?.teamId ?? null : null
  return {
    success: true,
    data: teams.map((team) => ({ id: team.id, name: team.name, modality: team.modality, site: team.site })),
    assignedTeamId,
    assignedTeamCount: memberships.length
  }
})
