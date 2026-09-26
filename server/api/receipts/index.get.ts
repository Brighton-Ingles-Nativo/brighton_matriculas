import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const query = getQuery(event)
  const requestedPage = Number(query.page || 1)
  const requestedLimit = Number(query.limit || 15)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 15
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const where = {
    ...(user.role?.name === 'asesor' ? { contract: { userId: user.id } } : {}),
    ...(search ? { OR: [
      { contract: { contractNumber: { contains: search, mode: 'insensitive' as const } } },
      { contract: { holderName: { contains: search, mode: 'insensitive' as const } } },
      { contract: { holderDni: { contains: search, mode: 'insensitive' as const } } },
      { concepts: { contains: search, mode: 'insensitive' as const } },
      { paymentMethod: { contains: search, mode: 'insensitive' as const } }
    ] } : {})
  }

  const [total, receipts] = await Promise.all([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      orderBy: { registeredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        contract: { select: { id: true, contractNumber: true, holderName: true, holderDni: true } },
        user: { select: { name: true, username: true } }
      }
    })
  ])

  return {
    success: true,
    data: receipts.map((receipt) => ({
      ...receipt,
      amount: receipt.amount?.toString() ?? null
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
})
