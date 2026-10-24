import type { Prisma } from '@prisma/client'
import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const operationalRoles = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  if (!operationalRoles.includes(user.role?.name || '')) throw createError({ statusCode: 403, message: 'No tienes permiso para consultar el dashboard' })

  const query = getQuery(event)
  const requestedPeriod = Number(query.period || 30)
  const period = [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30
  const now = new Date()
  const day = 24 * 60 * 60 * 1000
  const since = new Date(now.getTime() - period * day)
  const previousSince = new Date(since.getTime() - period * day)
  const role = user.role?.name || ''
  const groupingOptions = period <= 7 ? ['daily'] : period <= 30 ? ['daily', 'weekly'] : period <= 90 ? ['weekly', 'monthly'] : ['monthly']
  const defaultGrouping = period <= 7 ? 'daily' : period <= 30 ? 'weekly' : period <= 90 ? 'weekly' : 'monthly'
  const requestedGrouping = typeof query.grouping === 'string' ? query.grouping : ''
  const grouping = groupingOptions.includes(requestedGrouping) ? requestedGrouping : defaultGrouping
  const subordinateIds = role === 'supervisor'
    ? await Promise.all([
        prisma.user.findMany({ where: { supervisorId: user.id, role: { name: 'asesor' } }, select: { id: true } }),
        prisma.teamMember.findMany({ where: { user: { role: { name: 'asesor' } }, team: { active: true, supervisors: { some: { supervisorId: user.id } } } }, select: { userId: true } })
      ]).then(([directReports, teamMembers]) => [...new Set([user.id, ...directReports.map((item) => item.id), ...teamMembers.map((item) => item.userId)])])
    : []
  const visibleUserIds = role === 'asesor' ? [user.id] : role === 'supervisor' ? [user.id, ...subordinateIds] : undefined
  const contractScope: Prisma.ContractWhereInput = visibleUserIds ? { userId: { in: visibleUserIds } } : {}
  const contractWhere: Prisma.ContractWhereInput = { ...contractScope, registeredAt: { gte: since } }
  const expedientWhere: Prisma.ExpedientWhereInput = { contract: contractWhere }
  const roleExpedientScope: Prisma.ExpedientWhereInput = role === 'asistente_comercial'
    ? { currentLocation: 'ASISTENTE_COMERCIAL' }
    : role === 'verificador'
      ? { currentLocation: 'VERIFICACION' }
      : {}
  const advisorWhere: Prisma.UserWhereInput = { role: { name: 'asesor' }, ...(visibleUserIds ? { id: { in: visibleUserIds } } : {}) }
  const receiptScope: Prisma.ReceiptWhereInput = visibleUserIds ? { contract: contractScope } : {}

  const [contractSummary, previousContractSummary, signatureSummary, previousSignatureSummary, contractStatuses, signedContractCount, previousContractStatuses, stockContractStatuses, expedientStatuses, stockExpedientStatuses, locationStatuses, pendingRequests, unreadNotifications, contractsWithoutExpedient, scheduledAppointments, advisors, trendContracts, trendExpedientEvents, scheduleEvents, receiptSummary, previousReceiptSummary, outstandingBalanceSummary] = await Promise.all([
    prisma.contract.aggregate({ where: contractWhere, _count: { _all: true }, _sum: { programValue: true, initialPayment: true, balance: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, registeredAt: { gte: previousSince, lt: since } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, signedAt: { gte: since, lte: now } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, signedAt: { gte: previousSince, lt: since } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.groupBy({ where: contractWhere, by: ['status'], _count: { _all: true } }),
    prisma.contract.count({ where: { ...contractWhere, OR: [{ signedAccept: true }, { signedAt: { not: null } }] } }),
    prisma.contract.groupBy({ where: { ...contractScope, registeredAt: { gte: previousSince, lt: since } }, by: ['status'], _count: { _all: true } }),
    prisma.contract.groupBy({ where: contractScope, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: expedientWhere, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: { contract: contractScope, ...roleExpedientScope }, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: { contract: contractScope, ...roleExpedientScope }, by: ['currentLocation', 'status'], _count: { _all: true } }),
    prisma.cancellationRequest.count({ where: { status: 'PENDIENTE', contract: contractScope } }),
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
    prisma.contract.count({ where: { ...contractScope, OR: [{ signedAccept: true }, { signedAt: { not: null } }], expedient: null } }),
    prisma.expedient.count({ where: { ...expedientWhere, status: 'AGENDADO' } }),
    prisma.user.findMany({ where: advisorWhere, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ['asistente_comercial', 'verificador'].includes(role)
      ? Promise.resolve([])
      : prisma.contract.findMany({ where: { ...contractScope, OR: [{ registeredAt: { gte: since } }, { signedAt: { gte: since } }] }, select: { registeredAt: true, signedAt: true } }),
    role === 'asistente_comercial'
      ? prisma.expedientMovement.findMany({
          where: {
            createdAt: { gte: since },
            expedient: { contract: contractScope },
            OR: [
              { toLocation: 'ASISTENTE_COMERCIAL', OR: [{ fromLocation: null }, { fromLocation: { not: 'ASISTENTE_COMERCIAL' } }] },
              { fromLocation: 'ASISTENTE_COMERCIAL', toLocation: 'VERIFICACION' }
            ]
          },
          select: { createdAt: true, fromLocation: true, toLocation: true, toStatus: true }
        })
      : role === 'verificador'
        ? prisma.expedientMovement.findMany({
            where: { createdAt: { gte: since }, toLocation: 'VERIFICACION', toStatus: { in: ['AGENDADO', 'OBSERVADO', 'VERIFICADO'] }, expedient: { contract: contractScope } },
            select: { createdAt: true, fromLocation: true, toLocation: true, toStatus: true }
          })
        : Promise.resolve([]),
    role === 'verificador'
      ? prisma.expedientMovement.findMany({ where: { createdAt: { gte: since }, toLocation: 'VERIFICACION', toStatus: 'AGENDADO', expedient: { contract: contractScope } }, select: { createdAt: true } })
      : Promise.resolve([]),
    prisma.receipt.aggregate({ where: { ...receiptScope, registeredAt: { gte: since, lte: now } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.receipt.aggregate({ where: { ...receiptScope, registeredAt: { gte: previousSince, lt: since } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, status: { not: 'ANULADO' }, balance: { gt: 0 } }, _count: { _all: true }, _sum: { balance: true } })
  ])

  const canSeePerformance = ['admin', 'supervisor'].includes(role)
  const advisorStatusGroups = canSeePerformance
    ? await prisma.contract.groupBy({ where: contractWhere, by: ['userId', 'status'], _count: { _all: true }, _sum: { programValue: true } })
    : []
  const advisorSignatureGroups = canSeePerformance
    ? await prisma.contract.groupBy({ where: { ...contractWhere, OR: [{ signedAccept: true }, { signedAt: { not: null } }] }, by: ['userId'], _count: { _all: true }, _sum: { programValue: true } })
    : []
  const advisorPerformance = canSeePerformance ? advisors.map((advisor) => {
    const rows = advisorStatusGroups.filter((item) => item.userId === advisor.id)
    const total = rows.reduce((sum, item) => sum + item._count._all, 0)
    const signedRow = advisorSignatureGroups.find((item) => item.userId === advisor.id)
    const signed = signedRow?._count._all || 0
    const cancelled = rows.find((item) => item.status === 'ANULADO')?._count._all || 0
    return { id: advisor.id, name: advisor.name, total, signed, cancelled, contracted: Number(signedRow?._sum.programValue || 0), signingRate: total ? Math.round(signed / total * 100) : 0 }
  }).filter((item) => item.total > 0) : []

  const canSeeOrganization = canSeePerformance
  const organization = canSeeOrganization ? await (async () => {
    const teams = await prisma.team.findMany({
      where: role === 'supervisor' ? { active: true, supervisors: { some: { supervisorId: user.id } } } : { active: true },
      orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        siteId: true,
        site: { select: { id: true, name: true } },
        members: { where: { user: { active: true, role: { name: 'asesor' } } }, select: { userId: true } }
      }
    })
    const sites = await prisma.site.findMany({
      where: role === 'supervisor'
        ? { active: true, OR: [{ supervisors: { some: { supervisorId: user.id } } }, { teams: { some: { active: true, supervisors: { some: { supervisorId: user.id } } } } }] }
        : { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
    const advisorIds = [...new Set(teams.flatMap((team) => team.members.map((member) => member.userId)))]
    const [registrationGroups, signatureGroups] = advisorIds.length ? await Promise.all([
      prisma.contract.groupBy({ where: { userId: { in: advisorIds }, registeredAt: { gte: since, lte: now } }, by: ['userId'], _count: { _all: true } }),
      prisma.contract.groupBy({ where: { userId: { in: advisorIds }, signedAt: { gte: since, lte: now } }, by: ['userId'], _count: { _all: true } })
    ]) : [[], []]
    const registrationsByAdvisor = new Map(registrationGroups.map((item) => [item.userId, item._count._all]))
    const signaturesByAdvisor = new Map(signatureGroups.map((item) => [item.userId, item._count._all]))
    const teamBreakdown = teams.map((team) => {
      const memberIds = [...new Set(team.members.map((member) => member.userId))]
      return {
        id: team.id,
        name: team.name,
        site: team.site.name,
        advisors: memberIds.length,
        registrations: memberIds.reduce((sum, id) => sum + (registrationsByAdvisor.get(id) || 0), 0),
        signatures: memberIds.reduce((sum, id) => sum + (signaturesByAdvisor.get(id) || 0), 0)
      }
    })
    const siteBreakdown = sites.map((site) => {
      const memberIds = [...new Set(teams.filter((team) => team.siteId === site.id).flatMap((team) => team.members.map((member) => member.userId)))]
      return {
        id: site.id,
        name: site.name,
        teams: teams.filter((team) => team.siteId === site.id).length,
        advisors: memberIds.length,
        registrations: memberIds.reduce((sum, id) => sum + (registrationsByAdvisor.get(id) || 0), 0),
        signatures: memberIds.reduce((sum, id) => sum + (signaturesByAdvisor.get(id) || 0), 0)
      }
    })
    return { activeTeams: teams.length, activeSites: sites.length, teamBreakdown, siteBreakdown }
  })() : null

  const statusCount = (items: Array<{ status: string; _count: { _all: number } }>, status: string) => items.find((item) => item.status === status)?._count._all || 0
  const total = contractSummary._count._all
  const signed = signedContractCount
  const revision = statusCount(contractStatuses, 'REVISION')
  const cancelled = statusCount(contractStatuses, 'ANULADO')
  const previousPendingSignatures = statusCount(previousContractStatuses, 'REVISION')
  const expedients = expedientStatuses.reduce((sum, item) => sum + item._count._all, 0)
  const verified = statusCount(expedientStatuses, 'VERIFICADO')
  const rejected = statusCount(expedientStatuses, 'REBOTADO')
  const observed = statusCount(expedientStatuses, 'OBSERVADO')
  const commercialQueueWhere: Prisma.ExpedientWhereInput = { currentLocation: 'ASISTENTE_COMERCIAL', status: { in: ['CREADO', 'REBOTADO'] } }
  const verificationQueueWhere = { currentLocation: 'VERIFICACION' as const, status: { not: 'VERIFICADO' as const } }
  const supervisorReviewWhere: Prisma.ExpedientWhereInput = { currentLocation: 'SUPERVISOR', status: { in: ['CREADO', 'REBOTADO'] }, contract: contractScope }
  const [commercialQueueRecords, verificationQueueCount, upcomingAppointments, overdueAppointments] = await Promise.all([
    role === 'asistente_comercial' ? prisma.expedient.findMany({
      where: commercialQueueWhere,
      select: {
        id: true,
        sentToCommercialAt: true,
        createdAt: true,
        movements: {
          where: { toLocation: 'ASISTENTE_COMERCIAL', OR: [{ fromLocation: null }, { fromLocation: { not: 'ASISTENTE_COMERCIAL' } }] },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true }
        }
      }
    }) : Promise.resolve([]),
    role === 'verificador' ? prisma.expedient.count({ where: verificationQueueWhere }) : Promise.resolve(0),
    role === 'verificador' ? prisma.expedient.count({ where: { ...verificationQueueWhere, appointmentAt: { gt: now, lte: new Date(now.getTime() + 7 * day) } } }) : Promise.resolve(0),
    role === 'verificador' ? prisma.expedient.count({ where: { ...verificationQueueWhere, appointmentAt: { lt: now } } }) : Promise.resolve(0)
  ])
  const commercialQueueCount = commercialQueueRecords.length
  const datedCommercialQueue = commercialQueueRecords
  const commercialReturnedCount = locationStatuses.find((item) => item.currentLocation === 'ASISTENTE_COMERCIAL' && item.status === 'REBOTADO')?._count._all || 0
  const averageQueueDays = datedCommercialQueue.length
    ? Math.round(datedCommercialQueue.reduce((sum, item) => sum + (now.getTime() - (item.movements[0]?.createdAt || item.sentToCommercialAt || item.createdAt).getTime()) / day, 0) / datedCommercialQueue.length)
    : 0
  const supervisorReviewCount = role === 'supervisor' ? await prisma.expedient.count({ where: supervisorReviewWhere }) : 0
  const signaturesThisPeriod = signatureSummary._count._all
  const percentChange = (current: number, previous: number) => previous ? Math.round((current - previous) / previous * 100) : null
  const dateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
    return { year: Number(parts.find((part) => part.type === 'year')?.value), month: Number(parts.find((part) => part.type === 'month')?.value), day: Number(parts.find((part) => part.type === 'day')?.value) }
  }
  const limaMidnight = (date: Date) => {
    const { year, month, day: dateOfMonth } = dateParts(date)
    return new Date(Date.UTC(year, month - 1, dateOfMonth, 5))
  }
  const bucketFloor = (date: Date) => {
    const start = limaMidnight(date)
    if (grouping === 'daily') return start
    if (grouping === 'weekly') {
      const weekday = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())).getUTCDay()
      start.setUTCDate(start.getUTCDate() - ((weekday + 6) % 7))
      return start
    }
    start.setUTCDate(1)
    return start
  }
  const nextBucket = (start: Date) => {
    const next = new Date(start)
    if (grouping === 'daily') next.setUTCDate(next.getUTCDate() + 1)
    else if (grouping === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCMonth(next.getUTCMonth() + 1)
    return next
  }
  const bucketStarts: Date[] = []
  for (let cursor = bucketFloor(since); cursor < now; cursor = nextBucket(cursor)) bucketStarts.push(cursor)
  const trend = bucketStarts.map((bucketStart) => {
    const nextStart = nextBucket(bucketStart)
    const start = new Date(Math.max(bucketStart.getTime(), since.getTime()))
    const end = new Date(Math.min(nextStart.getTime(), now.getTime()))
    const contractEvents = trendContracts.filter((item) => {
      const registered = item.registeredAt >= start && item.registeredAt < end
      const signedAt = item.signedAt && item.signedAt >= start && item.signedAt < end
      return registered || signedAt
    })
    const expedientEvents = trendExpedientEvents.filter((item) => item.createdAt >= start && item.createdAt < end)
    const label = bucketStart.toLocaleDateString('es-PE', { timeZone: 'America/Lima', ...(grouping === 'monthly' ? { month: 'short', year: '2-digit' as const } : { day: 'numeric', month: 'short' }) })
    return {
      label,
      registered: contractEvents.filter((item) => item.registeredAt >= start && item.registeredAt < end).length,
      signed: contractEvents.filter((item) => item.signedAt && item.signedAt >= start && item.signedAt < end).length,
      commercial: expedientEvents.filter((item) => item.toLocation === 'ASISTENTE_COMERCIAL' && item.fromLocation !== 'ASISTENTE_COMERCIAL').length,
      verification: expedientEvents.filter((item) => item.toLocation === 'VERIFICACION' && item.fromLocation === 'ASISTENTE_COMERCIAL').length,
      verified: expedientEvents.filter((item) => ['OBSERVADO', 'VERIFICADO'].includes(item.toStatus || '')).length,
      appointments: scheduleEvents.filter((item) => item.createdAt >= start && item.createdAt < end).length
    }
  })

  const metric = (key: string, label: string, value: number, format: 'number' | 'currency' | 'percent' | 'days' = 'number', change: number | null = null, previousValue: number | null = null) => ({ key, label, value, format, change, previousValue })
  const registrationChange = percentChange(total, previousContractSummary._count._all)
  const signatureChange = percentChange(signaturesThisPeriod, previousSignatureSummary._count._all)
  const signedAmount = Number(signatureSummary._sum.programValue || 0)
  const previousSignedAmount = Number(previousSignatureSummary._sum.programValue || 0)
  const metrics = role === 'supervisor'
    ? [
        metric('registrations', 'Matrículas del periodo', total, 'number', registrationChange, previousContractSummary._count._all),
        metric('signatures', 'Contratos firmados', signaturesThisPeriod, 'number', signatureChange, previousSignatureSummary._count._all),
        metric('supervisorReview', 'Expedientes por revisar', supervisorReviewCount),
        metric('signedValue', 'Valor contratado', signedAmount, 'currency', percentChange(signedAmount, previousSignedAmount), previousSignedAmount)
      ]
    : ['admin', 'asesor'].includes(role)
    ? [
        metric('registrations', 'Matrículas', total, 'number', registrationChange, previousContractSummary._count._all),
        metric('signatures', 'Contratos firmados', signaturesThisPeriod, 'number', signatureChange, previousSignatureSummary._count._all),
        metric('pendingSignatures', 'Firma pendiente', revision, 'number', percentChange(revision, previousPendingSignatures), previousPendingSignatures),
        metric('signedValue', 'Valor contratado', signedAmount, 'currency', percentChange(signedAmount, previousSignedAmount), previousSignedAmount)
      ]
    : role === 'asistente_comercial'
      ? [
          metric('commercialQueue', 'Expedientes en esta área', commercialQueueCount),
          metric('commercialReturned', 'Rebotados pendientes', commercialReturnedCount),
          metric('queueAge', 'Promedio de espera', averageQueueDays, 'days'),
          metric('sentToVerification', 'Derivados a verificación', trend.reduce((sum, item) => sum + item.verification, 0))
        ]
      : [
          metric('verificationQueue', 'Expedientes por verificar', verificationQueueCount),
          metric('upcomingAppointments', 'Citas próximos 7 días', upcomingAppointments),
          metric('overdueAppointments', 'Citas vencidas', overdueAppointments),
          metric('verified', 'Verificaciones completadas', trend.reduce((sum, item) => sum + item.verified, 0))
        ]

  const contractWorkQueueWhere: Prisma.ContractWhereInput = {
    ...contractScope,
    OR: [
      { status: 'REVISION' },
      { OR: [{ signedAccept: true }, { signedAt: { not: null } }], expedient: { is: null } },
      { expedient: { is: { status: { in: ['REBOTADO', 'OBSERVADO'] } } } },
      ...(role === 'admin' ? [{ expedient: { is: { currentLocation: 'SUPERVISOR', status: { in: ['CREADO', 'REBOTADO'] } } } }] : []),
      { cancellationRequest: { is: { status: 'PENDIENTE' } } }
    ]
  }
  let workQueueTotal = 0
  let workQueue: any[] = []
  if (role === 'asistente_comercial') {
    const oldestIds = [...commercialQueueRecords]
      .sort((left, right) => {
        const leftAt = left.movements[0]?.createdAt || left.sentToCommercialAt || left.createdAt
        const rightAt = right.movements[0]?.createdAt || right.sentToCommercialAt || right.createdAt
        return leftAt.getTime() - rightAt.getTime()
      })
      .slice(0, 50)
      .map((item) => item.id)
    const items = oldestIds.length ? await prisma.expedient.findMany({
        where: { ...commercialQueueWhere, id: { in: oldestIds } },
        include: { contract: { select: { id: true, contractNumber: true, program: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } } } }, documents: { select: { type: true } } }
      }) : []
    workQueueTotal = commercialQueueCount
    workQueue = items
  } else if (role === 'verificador') {
    const [count, items] = await Promise.all([
      prisma.expedient.count({ where: verificationQueueWhere }),
      prisma.expedient.findMany({
        where: verificationQueueWhere,
        orderBy: [{ appointmentAt: 'asc' }, { updatedAt: 'asc' }],
        take: 50,
        include: { contract: { select: { id: true, contractNumber: true, program: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } } } }, documents: { select: { type: true } } }
      })
    ])
    workQueueTotal = count
    workQueue = items
  } else if (role === 'supervisor') {
    const supervisorQueueCandidates = await prisma.expedient.findMany({
      where: supervisorReviewWhere,
      select: {
        id: true,
        updatedAt: true,
        movements: {
          where: { toLocation: 'SUPERVISOR', OR: [{ fromLocation: null }, { fromLocation: { not: 'SUPERVISOR' } }] },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true }
        }
      }
    })
    const oldestSupervisorIds = [...supervisorQueueCandidates]
      .sort((left, right) => (left.movements[0]?.createdAt || left.updatedAt).getTime() - (right.movements[0]?.createdAt || right.updatedAt).getTime())
      .slice(0, 50)
      .map((item) => item.id)
    const items = oldestSupervisorIds.length ? await prisma.expedient.findMany({
        where: { ...supervisorReviewWhere, id: { in: oldestSupervisorIds } },
        include: { contract: { select: { id: true, contractNumber: true, program: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } } } }, documents: { select: { type: true } } }
      }) : []
    workQueueTotal = supervisorReviewCount
    workQueue = items
  } else {
    const [count, items] = await Promise.all([
      prisma.contract.count({ where: contractWorkQueueWhere }),
      prisma.contract.findMany({
        where: contractWorkQueueWhere,
        orderBy: { updatedAt: 'asc' },
        take: 50,
        select: { id: true, contractNumber: true, program: true, status: true, registeredAt: true, signedAt: true, updatedAt: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } }, expedient: { select: { id: true, status: true, observation: true, observationAt: true, createdAt: true, sentToCommercialAt: true, sentToVerificationAt: true, documents: { select: { type: true } } } }, cancellationRequest: { select: { status: true, reason: true, createdAt: true } } }
      })
    ])
    workQueueTotal = count
    workQueue = items
  }

  const queueLocation: 'SUPERVISOR' | 'ASISTENTE_COMERCIAL' | 'VERIFICACION' | null = role === 'supervisor'
    ? 'SUPERVISOR'
    : role === 'asistente_comercial'
      ? 'ASISTENTE_COMERCIAL'
      : role === 'verificador'
        ? 'VERIFICACION'
        : null
  const queueExpedientIds = queueLocation
    ? workQueue.flatMap((item) => 'contract' in item ? [item.id] : [])
    : []
  const queueEntryMovements = queueExpedientIds.length && role !== 'asistente_comercial'
    ? await prisma.expedientMovement.findMany({
        where: {
          expedientId: { in: queueExpedientIds },
          toLocation: queueLocation,
          OR: [{ fromLocation: null }, { fromLocation: { not: queueLocation } }]
        },
        orderBy: { createdAt: 'desc' },
        select: { expedientId: true, createdAt: true }
      })
    : []
  const queueEntryByExpedient = new Map<string, Date>()
  if (role === 'asistente_comercial') {
    for (const item of commercialQueueRecords) {
      const queueEntryAt = item.movements[0]?.createdAt
      if (queueEntryAt) queueEntryByExpedient.set(item.id, queueEntryAt)
    }
  }
  for (const movement of queueEntryMovements) {
    if (!queueEntryByExpedient.has(movement.expedientId)) queueEntryByExpedient.set(movement.expedientId, movement.createdAt)
  }

  return {
    success: true,
    role,
    scope: visibleUserIds ? 'personal_or_team' : role === 'asistente_comercial' ? 'commercial_queue' : role === 'verificador' ? 'verification_queue' : 'global',
    period,
    grouping,
    groupingOptions,
    summary: ['asistente_comercial', 'verificador'].includes(role) ? {} : {
      total, signed, revision, cancelled, expedients, verified, rejected, observed, pendingRequests, unreadNotifications, contractsWithoutExpedient, scheduledAppointments,
      ...(['admin', 'supervisor', 'asesor'].includes(role) ? {
        contracted: Number(contractSummary._sum.programValue || 0),
        initialPayment: Number(contractSummary._sum.initialPayment || 0),
        balance: Number(outstandingBalanceSummary._sum.balance || 0)
      } : {})
    },
    financeSummary: ['admin', 'supervisor', 'asesor'].includes(role) ? {
      collected: Number(receiptSummary._sum.amount || 0),
      receiptCount: receiptSummary._count._all,
      previousCollected: Number(previousReceiptSummary._sum.amount || 0),
      previousReceiptCount: previousReceiptSummary._count._all,
      collectionChange: percentChange(Number(receiptSummary._sum.amount || 0), Number(previousReceiptSummary._sum.amount || 0)),
      outstandingBalance: Number(outstandingBalanceSummary._sum.balance || 0),
      contractsWithBalance: outstandingBalanceSummary._count._all
    } : null,
    organization,
    metrics,
    trend,
    contractStatusBreakdown: ['asistente_comercial', 'verificador'].includes(role) ? [] : stockContractStatuses.map((item) => ({ key: item.status, label: item.status, value: item._count._all })),
    expedientStatusBreakdown: stockExpedientStatuses.map((item) => ({ key: item.status, label: item.status, value: item._count._all })),
    locationBreakdown: locationStatuses.map((item) => ({ location: item.currentLocation, status: item.status, value: item._count._all })),
    priorities: ['admin', 'supervisor', 'asesor'].includes(role) ? [
      { key: 'without_expedient', label: 'Contratos sin expediente', value: contractsWithoutExpedient, href: '/matricula?signature=firmado&expedientStatus=sin_expediente' },
      { key: 'pending_requests', label: 'Solicitudes de anulación pendientes', value: pendingRequests, href: '/matricula?cancellationStatus=PENDIENTE' },
      { key: 'unread_notifications', label: 'Notificaciones sin leer', value: unreadNotifications, href: '/notificaciones' }
    ].filter((item) => item.value > 0) : [],
    advisors: advisorPerformance,
    workQueueTotal,
    workQueue: workQueue.map((item) => {
      if ('contract' in item) {
        const documents = (item as typeof item & { documents?: Array<{ type: string }> }).documents || []
        const documentTypes = documents.map((document) => document.type)
        return {
          id: item.id,
          contractId: item.contract.id,
          contractNumber: item.contract.contractNumber,
          holderName: item.contract.customer.name,
          holderDni: item.contract.customer.dni,
          program: item.contract.program,
          advisorName: item.contract.user.name,
          status: item.status,
          location: item.currentLocation,
          updatedAt: item.updatedAt,
          queueEnteredAt: queueEntryByExpedient.get(item.id) || (item.currentLocation === 'ASISTENTE_COMERCIAL'
            ? item.sentToCommercialAt || item.createdAt
            : item.currentLocation === 'VERIFICACION'
              ? item.sentToVerificationAt || item.createdAt
              : item.updatedAt),
          appointmentAt: item.appointmentAt,
          appointmentType: item.appointmentType,
          observation: item.observation,
          documentCount: documentTypes.length,
          missingDocuments: ['DNI', 'VOUCHER'].filter((type) => !documentTypes.includes(type))
        }
      }
      const documents = item.expedient?.documents || []
      const documentTypes = documents.map((document: { type: string }) => document.type)
      return {
        id: item.expedient?.id || item.id,
        contractId: item.id,
        contractNumber: item.contractNumber,
        holderName: item.customer.name,
        holderDni: item.customer.dni,
        program: item.program,
        advisorName: item.user.name,
        status: item.cancellationRequest?.status === 'PENDIENTE' ? 'ANULACION_PENDIENTE' : item.expedient?.status || item.status,
        location: item.expedient ? 'EXPEDIENTE' : 'ASESOR',
        updatedAt: item.updatedAt,
        queueEnteredAt: item.cancellationRequest?.status === 'PENDIENTE'
          ? item.cancellationRequest.createdAt
          : item.expedient?.observationAt || item.expedient?.createdAt || item.signedAt || item.registeredAt,
        appointmentAt: null,
        appointmentType: null,
        observation: item.cancellationRequest?.status === 'PENDIENTE' ? item.cancellationRequest.reason : item.expedient?.observation || null,
        queueReason: item.cancellationRequest?.status === 'PENDIENTE' ? 'Solicitud de anulación por resolver' : (item.signedAccept || item.signedAt) && !item.expedient ? 'Expediente pendiente de creación' : item.expedient?.observation || null,
        documentCount: documentTypes.length,
        missingDocuments: ['DNI', 'VOUCHER'].filter((type) => !documentTypes.includes(type))
      }
    }).sort((left, right) => {
      if (role === 'verificador') {
        const leftAppointment = left.appointmentAt ? new Date(left.appointmentAt).getTime() : Number.POSITIVE_INFINITY
        const rightAppointment = right.appointmentAt ? new Date(right.appointmentAt).getTime() : Number.POSITIVE_INFINITY
        return leftAppointment - rightAppointment
      }
      return new Date(left.queueEnteredAt || left.updatedAt).getTime() - new Date(right.queueEnteredAt || right.updatedAt).getTime()
    })
  }
})
