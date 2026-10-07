import type { Prisma } from '@prisma/client'
import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const operationalRoles = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (!operationalRoles.includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para consultar el dashboard' })

  const query = getQuery(event)
  const requestedPeriod = Number(query.period || 30)
  const period = [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30
  const now = new Date()
  const day = 24 * 60 * 60 * 1000
  const since = new Date(now.getTime() - period * day)
  const previousSince = new Date(since.getTime() - period * day)
  const role = user.role?.name || 'user'
  const subordinateIds = role === 'supervisor'
    ? await Promise.all([
        prisma.user.findMany({ where: { supervisorId: user.id, role: { name: 'asesor' } }, select: { id: true } }),
        prisma.teamMember.findMany({ where: { user: { role: { name: 'asesor' } }, team: { supervisors: { some: { supervisorId: user.id } } } }, select: { userId: true } })
      ]).then(([directReports, teamMembers]) => [...new Set([user.id, ...directReports.map((item) => item.id), ...teamMembers.map((item) => item.userId)])])
    : []
  const visibleUserIds = role === 'asesor' ? [user.id] : role === 'supervisor' ? [user.id, ...subordinateIds] : undefined
  const contractScope: Prisma.ContractWhereInput = visibleUserIds ? { userId: { in: visibleUserIds } } : {}
  const contractWhere: Prisma.ContractWhereInput = { ...contractScope, registeredAt: { gte: since } }
  const expedientWhere: Prisma.ExpedientWhereInput = { contract: contractWhere }
  const advisorWhere: Prisma.UserWhereInput = { role: { name: 'asesor' }, ...(visibleUserIds ? { id: { in: visibleUserIds } } : {}) }

  const [contractSummary, previousContractSummary, signatureSummary, previousSignatureSummary, contractStatuses, previousContractStatuses, stockContractStatuses, expedientStatuses, stockExpedientStatuses, locationStatuses, pendingRequests, unreadNotifications, contractsWithoutExpedient, scheduledAppointments, advisors, trendContracts, trendExpedients, scheduleEvents] = await Promise.all([
    prisma.contract.aggregate({ where: contractWhere, _count: { _all: true }, _sum: { programValue: true, initialPayment: true, balance: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, registeredAt: { gte: previousSince, lt: since } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, signedAt: { gte: since, lte: now } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.aggregate({ where: { ...contractScope, signedAt: { gte: previousSince, lt: since } }, _count: { _all: true }, _sum: { programValue: true } }),
    prisma.contract.groupBy({ where: contractWhere, by: ['status'], _count: { _all: true } }),
    prisma.contract.groupBy({ where: { ...contractScope, registeredAt: { gte: previousSince, lt: since } }, by: ['status'], _count: { _all: true } }),
    prisma.contract.groupBy({ where: contractScope, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: expedientWhere, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: { contract: contractScope }, by: ['status'], _count: { _all: true } }),
    prisma.expedient.groupBy({ where: { contract: contractScope }, by: ['currentLocation', 'status'], _count: { _all: true } }),
    prisma.cancellationRequest.count({ where: { status: 'PENDIENTE', contract: contractScope } }),
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
    prisma.contract.count({ where: { ...contractScope, status: 'FIRMADO', expedient: null } }),
    prisma.expedient.count({ where: { ...expedientWhere, status: 'AGENDADO' } }),
    prisma.user.findMany({ where: advisorWhere, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.contract.findMany({ where: { ...contractScope, OR: [{ registeredAt: { gte: since } }, { signedAt: { gte: since } }] }, select: { registeredAt: true, signedAt: true } }),
    prisma.expedient.findMany({ where: { contract: contractScope, OR: [{ sentToCommercialAt: { gte: since } }, { sentToVerificationAt: { gte: since } }, { verifiedAt: { gte: since } }] }, select: { sentToCommercialAt: true, sentToVerificationAt: true, verifiedAt: true } }),
    prisma.expedientMovement.findMany({ where: { createdAt: { gte: since }, toStatus: 'AGENDADO', expedient: { contract: contractScope } }, select: { createdAt: true } })
  ])

  const canSeePerformance = ['admin', 'supervisor'].includes(role)
  const advisorStatusGroups = canSeePerformance
    ? await prisma.contract.groupBy({ where: contractWhere, by: ['userId', 'status'], _count: { _all: true }, _sum: { programValue: true } })
    : []
  const advisorPerformance = canSeePerformance ? advisors.map((advisor) => {
    const rows = advisorStatusGroups.filter((item) => item.userId === advisor.id)
    const total = rows.reduce((sum, item) => sum + item._count._all, 0)
    const signedRow = rows.find((item) => item.status === 'FIRMADO')
    const signed = signedRow?._count._all || 0
    const cancelled = rows.find((item) => item.status === 'ANULADO')?._count._all || 0
    return { id: advisor.id, name: advisor.name, total, signed, cancelled, contracted: Number(signedRow?._sum.programValue || 0), signingRate: total ? Math.round(signed / total * 100) : 0 }
  }).filter((item) => item.total > 0) : []

  const statusCount = (items: Array<{ status: string; _count: { _all: number } }>, status: string) => items.find((item) => item.status === status)?._count._all || 0
  const total = contractSummary._count._all
  const signed = statusCount(contractStatuses, 'FIRMADO')
  const revision = statusCount(contractStatuses, 'REVISION')
  const cancelled = statusCount(contractStatuses, 'ANULADO')
  const previousPendingSignatures = statusCount(previousContractStatuses, 'REVISION')
  const expedients = expedientStatuses.reduce((sum, item) => sum + item._count._all, 0)
  const verified = statusCount(expedientStatuses, 'VERIFICADO')
  const rejected = statusCount(expedientStatuses, 'REBOTADO')
  const observed = statusCount(expedientStatuses, 'OBSERVADO')
  const commercialQueueWhere: Prisma.ExpedientWhereInput = { currentLocation: 'ASISTENTE_COMERCIAL', status: { in: ['CREADO', 'REBOTADO'] } }
  const verificationQueueWhere = { currentLocation: 'VERIFICACION' as const, status: { not: 'VERIFICADO' as const } }
  const [commercialQueueRecords, verificationQueueCount, upcomingAppointments, overdueAppointments] = await Promise.all([
    role === 'asistente_comercial' ? prisma.expedient.findMany({ where: commercialQueueWhere, select: { sentToCommercialAt: true } }) : Promise.resolve([]),
    role === 'verificador' ? prisma.expedient.count({ where: verificationQueueWhere }) : Promise.resolve(0),
    role === 'verificador' ? prisma.expedient.count({ where: { ...verificationQueueWhere, appointmentAt: { gt: now, lte: new Date(now.getTime() + 7 * day) } } }) : Promise.resolve(0),
    role === 'verificador' ? prisma.expedient.count({ where: { ...verificationQueueWhere, appointmentAt: { lt: now } } }) : Promise.resolve(0)
  ])
  const commercialQueueCount = commercialQueueRecords.length
  const datedCommercialQueue = commercialQueueRecords.filter((item) => item.sentToCommercialAt)
  const commercialReturnedCount = locationStatuses.find((item) => item.currentLocation === 'ASISTENTE_COMERCIAL' && item.status === 'REBOTADO')?._count._all || 0
  const averageQueueDays = datedCommercialQueue.length
    ? Math.round(datedCommercialQueue.reduce((sum, item) => sum + (now.getTime() - item.sentToCommercialAt!.getTime()) / day, 0) / datedCommercialQueue.length)
    : 0
  const signaturesThisPeriod = signatureSummary._count._all
  const cohortSigningRate = total ? Math.round(signed / total * 100) : 0
  const percentChange = (current: number, previous: number) => previous ? Math.round((current - previous) / previous * 100) : null
  const bucketCount = 12
  const bucketSize = (now.getTime() - since.getTime()) / bucketCount
  const trend = Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(since.getTime() + index * bucketSize)
    const end = new Date(since.getTime() + (index + 1) * bucketSize)
    const contractEvents = trendContracts.filter((item) => {
      const registered = item.registeredAt >= start && item.registeredAt < end
      const signedAt = item.signedAt && item.signedAt >= start && item.signedAt < end
      return registered || signedAt
    })
    const expedientEvents = trendExpedients.filter((item) => [item.sentToCommercialAt, item.sentToVerificationAt, item.verifiedAt].some((date) => date && date >= start && date < end))
    const label = period <= 30
      ? start.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
      : start.toLocaleDateString('es-PE', { month: 'short', year: period > 90 ? '2-digit' : undefined })
    return {
      label,
      registered: contractEvents.filter((item) => item.registeredAt >= start && item.registeredAt < end).length,
      signed: contractEvents.filter((item) => item.signedAt && item.signedAt >= start && item.signedAt < end).length,
      commercial: expedientEvents.filter((item) => item.sentToCommercialAt && item.sentToCommercialAt >= start && item.sentToCommercialAt < end).length,
      verification: expedientEvents.filter((item) => item.sentToVerificationAt && item.sentToVerificationAt >= start && item.sentToVerificationAt < end).length,
      verified: expedientEvents.filter((item) => item.verifiedAt && item.verifiedAt >= start && item.verifiedAt < end).length,
      appointments: scheduleEvents.filter((item) => item.createdAt >= start && item.createdAt < end).length
    }
  })

  const metric = (key: string, label: string, value: number, format: 'number' | 'currency' | 'percent' | 'days' = 'number', change: number | null = null, previousValue: number | null = null) => ({ key, label, value, format, change, previousValue })
  const registrationChange = percentChange(total, previousContractSummary._count._all)
  const signatureChange = percentChange(signaturesThisPeriod, previousSignatureSummary._count._all)
  const signedAmount = Number(signatureSummary._sum.programValue || 0)
  const previousSignedAmount = Number(previousSignatureSummary._sum.programValue || 0)
  const metrics = ['admin', 'supervisor', 'asesor'].includes(role)
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
          metric('verified', 'Verificados en el periodo', trend.reduce((sum, item) => sum + item.verified, 0))
        ]

  const workQueue = role === 'asistente_comercial'
    ? await prisma.expedient.findMany({
      where: { currentLocation: 'ASISTENTE_COMERCIAL', status: { in: ['CREADO', 'REBOTADO'] } },
      orderBy: [{ sentToCommercialAt: 'asc' }, { updatedAt: 'asc' }],
      take: 12,
      include: { contract: { select: { id: true, contractNumber: true, program: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } } } }, documents: { select: { type: true } } }
    })
    : role === 'verificador'
      ? await prisma.expedient.findMany({
        where: { currentLocation: 'VERIFICACION', status: { not: 'VERIFICADO' } },
        orderBy: [{ appointmentAt: 'asc' }, { updatedAt: 'asc' }],
        take: 12,
        include: { contract: { select: { id: true, contractNumber: true, program: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } } } } }
      })
      : await prisma.contract.findMany({
        where: {
          ...contractScope,
          OR: [
            { status: 'REVISION' },
            { status: 'FIRMADO', expedient: { is: null } },
            { expedient: { is: { status: { in: ['REBOTADO', 'OBSERVADO'] } } } },
            { cancellationRequest: { is: { status: 'PENDIENTE' } } }
          ]
        },
        orderBy: { updatedAt: 'asc' },
        take: 12,
        select: { id: true, contractNumber: true, program: true, status: true, registeredAt: true, updatedAt: true, customer: { select: { name: true, dni: true } }, user: { select: { name: true } }, expedient: { select: { id: true, status: true, observation: true, sentToCommercialAt: true, sentToVerificationAt: true } }, cancellationRequest: { select: { status: true, reason: true } } }
      })

  return {
    success: true,
    role,
    scope: visibleUserIds ? 'personal_or_team' : 'global',
    period,
    summary: { total, signed, revision, cancelled, expedients, verified, rejected, observed, pendingRequests, unreadNotifications, contractsWithoutExpedient, scheduledAppointments, contracted: Number(contractSummary._sum.programValue || 0), initialPayment: Number(contractSummary._sum.initialPayment || 0), balance: Number(contractSummary._sum.balance || 0) },
    metrics,
    trend,
    contractStatusBreakdown: stockContractStatuses.map((item) => ({ key: item.status, label: item.status, value: item._count._all })),
    expedientStatusBreakdown: stockExpedientStatuses.map((item) => ({ key: item.status, label: item.status, value: item._count._all })),
    locationBreakdown: locationStatuses.map((item) => ({ location: item.currentLocation, status: item.status, value: item._count._all })),
    priorities: ['admin', 'supervisor', 'asesor'].includes(role) ? [
      { key: 'without_expedient', label: 'Contratos sin expediente', value: contractsWithoutExpedient, href: '/matricula?status=firmado&expedientStatus=sin_expediente' },
      { key: 'pending_requests', label: 'Solicitudes de anulación pendientes', value: pendingRequests, href: '/matricula' },
      { key: 'unread_notifications', label: 'Notificaciones sin leer', value: unreadNotifications, href: '/notificaciones' }
    ].filter((item) => item.value > 0) : [],
    advisors: advisorPerformance,
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
          queueEnteredAt: item.currentLocation === 'ASISTENTE_COMERCIAL' ? item.sentToCommercialAt : item.sentToVerificationAt,
          appointmentAt: item.appointmentAt,
          appointmentType: item.appointmentType,
          observation: item.observation,
          documentCount: documentTypes.length,
          missingDocuments: ['DNI', 'VOUCHER_PAGO'].filter((type) => !documentTypes.includes(type))
        }
      }
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
        queueEnteredAt: item.expedient?.sentToCommercialAt || item.registeredAt,
        appointmentAt: null,
        appointmentType: null,
        observation: item.cancellationRequest?.status === 'PENDIENTE' ? item.cancellationRequest.reason : item.expedient?.observation || null,
        queueReason: item.cancellationRequest?.status === 'PENDIENTE' ? 'Solicitud de anulación por resolver' : item.status === 'FIRMADO' && !item.expedient ? 'Expediente pendiente de creación' : item.expedient?.observation || null,
        documentCount: 0,
        missingDocuments: []
      }
    })
  }
})
