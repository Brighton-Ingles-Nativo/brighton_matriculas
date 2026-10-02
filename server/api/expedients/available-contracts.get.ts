import { requireExpedientUser } from '../../utils/expedients'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const contracts = await prisma.contract.findMany({
    where: {
      accepted: true,
      expedient: null,
      ...(user.role?.name === 'asesor' ? { userId: user.id } : {})
    },
    orderBy: { contractNumber: 'desc' },
    take: 100,
    select: {
      id: true,
      contractNumber: true,
      status: true,
      customer: { select: { name: true, dni: true } },
      user: { select: { name: true } }
    }
  })

  return {
    success: true,
    data: contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      holderName: contract.customer.name,
      holderDni: contract.customer.dni,
      advisorName: contract.user.name,
      status: contract.status
    }))
  }
})
