import { requireExpedientUser } from '../../../utils/expedients'
import { assertContractAccess } from '../../../utils/contract-access'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  if (!expedientId || !/^[0-9a-f-]{36}$/i.test(expedientId)) {
    throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })
  }

  const expedient = await prisma.expedient.findUnique({
    where: { id: expedientId },
    select: { id: true, contractId: true }
  })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  await assertContractAccess(user, expedient.contractId)

  const movements = await prisma.expedientMovement.findMany({
    where: { expedientId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, username: true } } }
  })

  return {
    success: true,
    data: movements.map((movement) => ({
      id: movement.id,
      fromStatus: movement.fromStatus,
      toStatus: movement.toStatus,
      fromLocation: movement.fromLocation,
      toLocation: movement.toLocation,
      observation: movement.observation,
      createdAt: movement.createdAt,
      user: movement.user
    }))
  }
})
