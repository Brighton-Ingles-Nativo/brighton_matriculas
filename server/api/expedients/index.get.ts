import { getUserBySession } from '../../utils/auth'
import { contractAccessWhere } from '../../utils/contract-access'
import { prisma } from '../../utils/prisma'
import { Prisma } from '@prisma/client'

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
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const location = typeof query.location === 'string' ? query.location.trim() : ''

  const contractFilter: Prisma.ContractWhereInput = {
    AND: [contractAccessWhere(user)],
    ...(search ? {
      OR: [
        { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        { customer: { dni: { contains: search, mode: 'insensitive' as const } } },
        ...(user.role?.name !== 'asesor' ? [{ user: { name: { contains: search, mode: 'insensitive' as const } } }] : [])
      ]
    } : {})
  }

  const statusFilter: Prisma.ExpedientWhereInput = status === 'PENDIENTE'
    ? { status: 'CREADO', currentLocation: 'SUPERVISOR' }
    : status === 'EN_COMERCIAL'
      ? { status: 'CREADO', currentLocation: 'ASISTENTE_COMERCIAL' }
      : status === 'EN_VERIFICACION'
        ? { status: 'CREADO', currentLocation: 'VERIFICACION' }
        : status === 'REBOTADO_COMERCIAL'
          ? { status: 'REBOTADO', currentLocation: 'ASESOR' }
          : status === 'REBOTADO_VERIFICACION'
            ? { status: 'REBOTADO', currentLocation: 'ASISTENTE_COMERCIAL' }
            : status === 'VERIFICADA_CON_OBSERVACIONES'
              ? { status: 'OBSERVADO' }
                : status === 'VERIFICADA'
                  ? { status: 'VERIFICADO' }
                  : {}
  const locationFilter: Prisma.ExpedientWhereInput = ['ASESOR', 'SUPERVISOR', 'ASISTENTE_COMERCIAL', 'VERIFICACION'].includes(location)
    ? { currentLocation: location as Prisma.ExpedientWhereInput['currentLocation'] }
    : {}
  const where: Prisma.ExpedientWhereInput = {
    ...(Object.keys(contractFilter).length ? { contract: contractFilter } : {}),
    ...statusFilter,
    ...locationFilter
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
      currentLocation: expedient.currentLocation,
      responsibleId: expedient.responsibleId,
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
