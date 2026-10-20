import type { Prisma } from '@prisma/client'
import { getUserBySession } from '../../utils/auth'
import { contractAccessWhere } from '../../utils/contract-access'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Sesión no válida' })
  }

  const query = getQuery(event)
  const requestedPage = Number(query.page || 1)
  const requestedLimit = Number(query.limit || 15)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 50)
    : 15
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const signature = typeof query.signature === 'string' ? query.signature.trim() : ''
  const cancellationStatus = typeof query.cancellationStatus === 'string' ? query.cancellationStatus.trim() : ''
  const missingExpedient = query.expedientStatus === 'sin_expediente'
  const includeAdvisorOrganization = ['admin', 'verificador'].includes(user.role?.name ?? '')

  const statusFilter = status === 'revision'
    ? { status: 'REVISION' as const }
    : status === 'aprobado'
      ? { status: 'APROBADO' as const }
      : status === 'anulado'
        ? { status: 'ANULADO' as const }
        : null
  const signatureFilter: Prisma.ContractWhereInput | null = signature === 'firmado'
    ? { OR: [{ signedAccept: true }, { signedAt: { not: null } }] }
    : signature === 'no_firmado'
      ? { signedAccept: false, signedAt: null }
      : null

  const clauses: Prisma.ContractWhereInput[] = [contractAccessWhere(user)]
  if (search) clauses.push({ OR: [
    { contractNumber: { contains: search, mode: 'insensitive' as const } },
    { customer: { name: { contains: search, mode: 'insensitive' as const } } },
    { customer: { dni: { contains: search, mode: 'insensitive' as const } } },
    ...(user.role?.name !== 'asesor' ? [{ user: { name: { contains: search, mode: 'insensitive' as const } } }] : [])
  ] })
  if (missingExpedient) clauses.push({ expedient: { is: null } })
  if (statusFilter) clauses.push(statusFilter)
  if (signatureFilter) clauses.push(signatureFilter)
  if (cancellationStatus === 'PENDIENTE') clauses.push({ cancellationRequest: { is: { status: 'PENDIENTE' } } })
  const where: Prisma.ContractWhereInput = { AND: clauses }

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

  const advisorTeams = includeAdvisorOrganization && contracts.length
    ? await prisma.teamMember.findMany({
        where: { userId: { in: [...new Set(contracts.map(contract => contract.userId))] } },
        select: { userId: true, team: { select: { site: { select: { name: true } } } } }
      })
    : []
  const sitesByAdvisor = new Map<string, Set<string>>()
  for (const membership of advisorTeams) {
    let sites = sitesByAdvisor.get(membership.userId)
    if (!sites) {
      sites = new Set()
      sitesByAdvisor.set(membership.userId, sites)
    }
    sites.add(membership.team.site.name)
  }

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
      signedAccept: contract.signedAccept,
      signedAt: contract.signedAt,
      registeredAt: contract.registeredAt,
      advisor: {
        ...contract.user,
        sites: [...(sitesByAdvisor.get(contract.userId) ?? new Set<string>())]
          .sort((a, b) => a.localeCompare(b))
      },
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
