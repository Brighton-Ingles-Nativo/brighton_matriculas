import { requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const strategies = await prisma.strategy.findMany({
    orderBy: [{ active: 'desc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      _count: { select: { contracts: true } }
    }
  })

  return {
    success: true,
    data: strategies.map((strategy) => ({
      id: strategy.id,
      code: strategy.code,
      name: strategy.name,
      description: strategy.description,
      active: strategy.active,
      displayOrder: strategy.displayOrder,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
      createdBy: strategy.createdBy,
      updatedBy: strategy.updatedBy,
      contractCount: strategy._count.contracts
    }))
  }
})
