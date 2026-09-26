import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID de contrato requerido' })
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de contrato inválido' })

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
      receipts: {
        orderBy: { registeredAt: 'desc' },
        select: {
          id: true,
          registeredRole: true,
          amount: true,
          concepts: true,
          otherConcept: true,
          paymentMethod: true,
          operationNumber: true,
          bank: true,
          transactionDate: true,
          registeredAt: true
        }
      }
    }
  })

  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Contrato no encontrado' })
  if (user.role?.name === 'asesor' && contract.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este contrato' })
  }

  const { accessToken: _accessToken, ...safeContract } = contract

  return {
    success: true,
    data: {
      ...safeContract,
      advisor: contract.user,
      programValue: contract.programValue.toString(),
      initialPayment: contract.initialPayment?.toString() ?? null,
      balance: contract.balance?.toString() ?? null,
      installmentValue: contract.installmentValue?.toString() ?? null,
      receipts: contract.receipts.map((receipt) => ({
        ...receipt,
        amount: receipt.amount?.toString() ?? null
      }))
    }
  }
})
