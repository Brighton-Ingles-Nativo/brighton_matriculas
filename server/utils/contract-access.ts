import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type AccessUser = { id: string; role?: { name: string } | null }

export function contractAccessWhere(user: AccessUser): Prisma.ContractWhereInput {
  if (user.role?.name === 'asesor') return { userId: user.id }
  if (user.role?.name === 'supervisor') {
    return {
      OR: [
        { userId: user.id },
        { user: { supervisorId: user.id } },
        { user: { teamMemberships: { some: { team: { active: true, supervisors: { some: { supervisorId: user.id } } } } } } }
      ]
    }
  }
  return {}
}

export async function assertContractAccess(user: AccessUser, contractId: string): Promise<void> {
  if (!['asesor', 'supervisor'].includes(user.role?.name || '')) return
  const accessible = await prisma.contract.count({ where: { id: contractId, ...contractAccessWhere(user) } })
  if (!accessible) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta matrícula' })
}

export async function supervisorRecipientIds(advisorId: string): Promise<string[]> {
  const advisor = await prisma.user.findUnique({
    where: { id: advisorId },
    select: {
      supervisorId: true,
      teamMemberships: {
        where: { team: { active: true } },
        select: { team: { select: { supervisors: { select: { supervisorId: true } } } } }
      }
    }
  })
  if (!advisor) return []
  return [...new Set([
    advisor.supervisorId,
    ...advisor.teamMemberships.flatMap((membership) => membership.team.supervisors.map((supervisor) => supervisor.supervisorId))
  ].filter((id): id is string => Boolean(id)))]
}
