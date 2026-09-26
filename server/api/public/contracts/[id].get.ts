import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'

function tokenIsValid(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getQuery(event).token
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !tokenIsValid(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Enlace público inválido' })
  }

  const contract = await prisma.contract.findFirst({
    where: { id, accessToken: token, tokenExpiresAt: { gt: new Date() } },
    include: {
      receipts: {
        orderBy: { registeredAt: 'desc' },
        select: { id: true, amount: true, concepts: true, otherConcept: true, paymentMethod: true, operationNumber: true, bank: true, transactionDate: true, registeredAt: true }
      }
    }
  })

  if (!contract) throw createError({ statusCode: 404, statusMessage: 'El enlace ha expirado o no es válido' })

  return {
    success: true,
    data: {
      ...contract,
      accessToken: undefined,
      programValue: contract.programValue.toString(),
      initialPayment: contract.initialPayment?.toString() ?? null,
      balance: contract.balance?.toString() ?? null,
      installmentValue: contract.installmentValue?.toString() ?? null,
      receipts: contract.receipts.map((receipt) => ({ ...receipt, amount: receipt.amount?.toString() ?? null }))
    }
  }
})
