import { requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const teams = await prisma.team.findMany({ orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }], include: { site: true, supervisors: { include: { supervisor: { select: { id: true, name: true, username: true, active: true } } } }, members: { include: { user: { select: { id: true, name: true, username: true, active: true, role: { select: { name: true } } } } } } } })
  return { success: true, data: teams.map((team) => ({ id: team.id, name: team.name, modality: team.modality, active: team.active, site: { id: team.site.id, name: team.site.name }, supervisors: team.supervisors.map(({ supervisor }) => supervisor), members: team.members.map(({ user }) => user) })) }
})
