import { getUserBySession } from '../../utils/auth'
import { contractAccessWhere } from '../../utils/contract-access'
import { prisma } from '../../utils/prisma'
import type { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const query = getQuery(event)
  const requestedPage = Number(query.page || 1)
  const requestedLimit = Number(query.limit || 15)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 15
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const accessWhere = contractAccessWhere(user)
  const where: Prisma.ReceiptWhereInput = {
    ...(Object.keys(accessWhere).length ? { contract: accessWhere } : {}),
    ...(search ? { OR: [
      { contract: { contractNumber: { contains: search, mode: 'insensitive' as const } } },
      { contract: { customer: { name: { contains: search, mode: 'insensitive' as const } } } },
      { contract: { customer: { dni: { contains: search, mode: 'insensitive' as const } } } },
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
        contract: { select: { id: true, contractNumber: true, customer: { select: { name: true, dni: true } } } },
        user: { select: { name: true, username: true } }
      }
    })
  ])

  return {
    success: true,
    data: receipts.map((receipt) => ({
      ...receipt,
      amount: receipt.amount?.toString() ?? null,
      contract: {
        ...receipt.contract,
        holderName: receipt.contract.customer.name,
        holderDni: receipt.contract.customer.dni
      }
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
})
