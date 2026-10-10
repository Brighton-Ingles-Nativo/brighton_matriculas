import { requireExpedientUser } from '../../utils/expedients'
import { contractAccessWhere } from '../../utils/contract-access'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  if (!['asesor', 'supervisor','admin'].includes(user.role?.name || '')) {
    throw createError({ statusCode: 403, statusMessage: 'Solo el asesor o supervisor puede crear un expediente.' })
  }
  const contracts = await prisma.contract.findMany({
    where: {
      signedAt: { not: null },
      expedient: null,
      ...contractAccessWhere(user)
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
