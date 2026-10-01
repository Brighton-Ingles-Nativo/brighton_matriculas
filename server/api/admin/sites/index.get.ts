import { requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sites = await prisma.site.findMany({
    orderBy: { name: 'asc' },
    include: {
      teams: { orderBy: { name: 'asc' }, include: { supervisors: { include: { supervisor: { select: { id: true, name: true, username: true } } } } } },
      supervisors: { include: { supervisor: { select: { id: true, name: true, username: true, active: true } } } }
    }
  })
  return { success: true, data: sites.map((site) => ({ id: site.id, name: site.name, active: site.active, createdAt: site.createdAt, updatedAt: site.updatedAt, supervisors: site.supervisors.map(({ supervisor }) => supervisor), teams: site.teams.map((team) => ({ id: team.id, name: team.name, modality: team.modality, active: team.active, supervisors: team.supervisors.map(({ supervisor }) => supervisor) })) })) }
})
