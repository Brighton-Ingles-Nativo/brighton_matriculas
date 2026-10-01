import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const allowedRoles = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']
  if (!allowedRoles.includes(user.role?.name || '')) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para consultar expedientes' })
  }

  const query = getQuery(event)
  const requestedPage = Number(query.page || 1)
  const requestedLimit = Number(query.limit || 15)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 15
  const holderName = typeof query.holderName === 'string' ? query.holderName.trim() : ''
  const holderDni = typeof query.holderDni === 'string' ? query.holderDni.trim() : ''
  const advisorName = typeof query.advisorName === 'string' ? query.advisorName.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''

  const contractFilter = {
    ...(user.role?.name === 'asesor' ? { userId: user.id } : {}),
    ...(holderName || holderDni ? {
      customer: {
        ...(holderName ? { name: { contains: holderName, mode: 'insensitive' as const } } : {}),
        ...(holderDni ? { dni: { contains: holderDni, mode: 'insensitive' as const } } : {})
      }
    } : {}),
    ...(advisorName && user.role?.name !== 'asesor' ? {
      user: { name: { contains: advisorName, mode: 'insensitive' as const } }
    } : {})
  }

  const where = {
    ...(Object.keys(contractFilter).length ? { contract: contractFilter } : {}),
    ...(status ? { status } : {})
  }

  const [total, expedients] = await Promise.all([
    prisma.expedient.count({ where }),
    prisma.expedient.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            customer: { select: { name: true, dni: true } },
            user: { select: { name: true } }
          }
        },
        _count: { select: { documents: true } }
      }
    })
  ])

  return {
    success: true,
    data: expedients.map((expedient) => ({
      id: expedient.id,
      contractId: expedient.contract.id,
      contractNumber: expedient.contract.contractNumber,
      holderName: expedient.contract.customer.name,
      holderDni: expedient.contract.customer.dni,
      advisorName: expedient.contract.user.name,
      status: expedient.status,
      documentCount: expedient._count.documents,
      createdAt: expedient.createdAt,
      updatedAt: expedient.updatedAt,
      sentToCommercialAt: expedient.sentToCommercialAt,
      sentToVerificationAt: expedient.sentToVerificationAt,
      verifiedAt: expedient.verifiedAt
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
})
