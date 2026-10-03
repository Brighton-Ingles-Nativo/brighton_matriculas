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
  const holderName = typeof query.holderName === 'string' ? query.holderName.trim() : ''
  const holderDni = typeof query.holderDni === 'string' ? query.holderDni.trim() : ''
  const advisorName = typeof query.advisorName === 'string' ? query.advisorName.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''

  const statusFilter = status === 'revision'
    ? { status: 'REVISION' as const }
    : status === 'firmado'
      ? { status: 'FIRMADO' as const }
      : status === 'anulado'
        ? { status: 'ANULADO' as const }
        : {}

  const where = {
    ...(user.role?.name === 'asesor' ? { userId: user.id } : {}),
    ...(holderName || holderDni ? {
      customer: {
        ...(holderName ? { name: { contains: holderName, mode: 'insensitive' as const } } : {}),
        ...(holderDni ? { dni: { contains: holderDni, mode: 'insensitive' as const } } : {})
      }
    } : {}),
    ...(advisorName ? { user: { name: { contains: advisorName, mode: 'insensitive' as const } } } : {}),
    ...statusFilter
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
      signedAt: contract.signedAt,
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
