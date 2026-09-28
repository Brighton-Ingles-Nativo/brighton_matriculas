import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  }

  const query = getQuery(event)
  const requestedPage = Number(query.page || 1)
  const requestedLimit = Number(query.limit || 15)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 50)
    : 15
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const where = {
    ...(user.role?.name === 'asesor' ? { userId: user.id } : {}),
    ...(search ? {
      OR: [
        { contractNumber: { contains: search, mode: 'insensitive' as const } },
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        { customer: { dni: { contains: search, mode: 'insensitive' as const } } }
      ]
    } : {})
  }

  const [total, contracts] = await Promise.all([
    prisma.contract.count({ where }),
    prisma.contract.findMany({
      where,
      orderBy: { contractNumber: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true, username: true } },
        customer: { select: { name: true, dni: true } },
        receipts: { select: { id: true }, orderBy: { registeredAt: 'desc' }, take: 1 }
      }
    })
  ])

  return {
    success: true,
    data: contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      holderName: contract.customer.name,
      holderDni: contract.customer.dni,
      program: contract.program,
      plan: contract.plan,
      programValue: contract.programValue.toString(),
      status: contract.status,
      accepted: contract.accepted,
      registeredAt: contract.registeredAt,
      advisor: contract.user,
      receiptCount: contract.receipts.length,
      latestReceiptId: contract.receipts[0]?.id ?? null
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    role: user.role?.name ?? null
  }
})
