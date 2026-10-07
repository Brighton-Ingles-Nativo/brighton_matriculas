import type { Prisma } from '@prisma/client'
import { contractAccessWhere } from '../../contract-access'
import { prisma } from '../../prisma'
import type { ExportColumn, ExportDocument } from '../types'

type ExportRole = 'admin' | 'asesor' | 'supervisor' | 'asistente_comercial' | 'verificador'

const baseColumns: ExportColumn[] = [
  { header: 'Número de matrícula', key: 'contractNumber' },
  { header: 'Nombre del titular', key: 'holderName' },
  { header: 'DNI del titular', key: 'holderDni' },
  { header: 'Plan del cliente', key: 'plan' },
  { header: 'Modalidad', key: 'modality' },
  { header: 'Monto del contrato', key: 'programValue' },
  { header: 'Tipo de financiamiento', key: 'financingType' },
  { header: 'Estado de matrícula', key: 'status' }
]
const advisorColumn: ExportColumn = { header: 'Nombre de asesor', key: 'advisorName' }
const siteColumn: ExportColumn = { header: 'Nombre de la sede', key: 'siteName' }
const verificationColumns: ExportColumn[] = [
  { header: 'Fecha de primer contacto', key: 'firstContactAt' },
  { header: 'Fecha de cita programada', key: 'appointmentAt' },
  { header: 'Fecha de reprogramación de cita', key: 'appointmentRescheduledAt' },
  { header: 'Tipo de cita', key: 'appointmentType' },
  { header: 'Estrategia', key: 'strategy' },
  { header: 'Asesor Validación', key: 'advisorValidationName' },
  { header: 'Calificación de asesoría', key: 'advisoryRating' },
  { header: 'Fecha de inicio de clases', key: 'classStartDate' },
  { header: 'Fecha de pago', key: 'paymentDate' }
]

function columnsFor(role: ExportRole): ExportColumn[] {
  if (role === 'asesor') return baseColumns
  if (role === 'supervisor') return [...baseColumns, advisorColumn]
  if (role === 'asistente_comercial') return [...baseColumns, advisorColumn, siteColumn]
  if (role === 'verificador') return [...baseColumns, advisorColumn, siteColumn, ...verificationColumns]
  return [...baseColumns, advisorColumn, siteColumn, ...verificationColumns]
}

type EnrollmentContract = Prisma.ContractGetPayload<{
  include: {
    customer: true
    user: { select: { name: true; teamMemberships: { include: { team: { include: { site: true } } } } } }
    otherData: true
    strategyDefinition: { select: { name: true } }
    expedient: true
  }
}>

function dateValue(value: Date | null | undefined): string | null { return value ? value.toISOString() : null }

function statusLabel(contract: EnrollmentContract): string {
  if (contract.status === 'ANULADO') return 'ANULADO'
  if (!contract.expedient) return contract.status === 'FIRMADO' ? 'FIRMADO' : 'EN REVISIÓN CLIENTE'
  if (contract.expedient.status === 'REBOTADO') return 'REBOTADA'
  if (contract.expedient.status === 'AGENDADO') return 'CITA PROGRAMADA'
  if (contract.expedient.status === 'OBSERVADO') return 'VERIFICADA CON OBSERVACIONES'
  if (contract.expedient.status === 'VERIFICADO') return 'VERIFICADA'
  if (contract.expedient.currentLocation === 'ASISTENTE_COMERCIAL') return 'EN COMERCIAL'
  if (contract.expedient.currentLocation === 'VERIFICACION') return 'EN VERIFICACIÓN'
  return contract.status === 'FIRMADO' ? 'FIRMADO' : 'EN REVISIÓN CLIENTE'
}

function rowFor(contract: EnrollmentContract): Record<string, unknown> {
  const siteName = [...new Set(contract.user.teamMemberships.map((membership) => membership.team.site.name))].join(', ') || null
  const expedient = contract.expedient
  return {
    contractNumber: contract.contractNumber,
    holderName: contract.customer.name,
    holderDni: contract.customer.dni,
    plan: contract.plan,
    modality: contract.modality,
    programValue: contract.programValue.toString(),
    financingType: contract.cashPayment ? 'Contado' : contract.financedPayment ? 'Financiado' : contract.otherPayment,
    status: statusLabel(contract),
    advisorName: contract.user.name,
    siteName,
    firstContactAt: dateValue(expedient?.firstContactAt),
    appointmentAt: dateValue(expedient?.appointmentAt),
    appointmentRescheduledAt: dateValue(expedient?.appointmentRescheduledAt),
    appointmentType: expedient?.appointmentType,
    strategy: contract.strategyNameSnapshot ?? contract.strategyDefinition?.name ?? contract.otherData?.strategy,
    advisorValidationName: expedient?.advisorValidationName,
    advisoryRating: expedient?.advisoryRating,
    classStartDate: dateValue(expedient?.classStartDate),
    paymentDate: dateValue(expedient?.paymentDate)
  }
}

export async function buildEnrollmentExport(
  user: { id: string; role: { name: string } },
  filters: { holderName?: string; holderDni?: string; advisorName?: string; status?: string; search?: string; expedientStatus?: string; location?: string }
): Promise<ExportDocument> {
  const role = user.role.name as ExportRole
  const missingExpedient = filters.expedientStatus === 'sin_expediente'
  const statusFilter = filters.status === 'revision'
    ? { status: 'REVISION' as const }
    : filters.status === 'firmado'
      ? { status: 'FIRMADO' as const }
      : filters.status === 'anulado'
        ? { status: 'ANULADO' as const }
        : {}
  const expedientFilter: Prisma.ExpedientWhereInput = filters.expedientStatus === 'PENDIENTE'
    ? { status: 'CREADO', currentLocation: 'SUPERVISOR' }
    : filters.expedientStatus === 'EN_COMERCIAL'
      ? { status: 'CREADO', currentLocation: 'ASISTENTE_COMERCIAL' }
      : filters.expedientStatus === 'REBOTADO_COMERCIAL'
        ? { status: 'REBOTADO', currentLocation: 'ASESOR' }
        : filters.expedientStatus === 'EN_VERIFICACION'
          ? { status: 'CREADO', currentLocation: 'VERIFICACION' }
          : filters.expedientStatus === 'REBOTADO_VERIFICACION'
            ? { status: 'REBOTADO', currentLocation: 'ASISTENTE_COMERCIAL' }
            : filters.expedientStatus === 'VERIFICADA_CON_OBSERVACIONES'
              ? { status: 'OBSERVADO' }
              : filters.expedientStatus === 'VERIFICADA'
                ? { status: 'VERIFICADO' }
                : {}
  if (filters.location && ['ASESOR', 'SUPERVISOR', 'ASISTENTE_COMERCIAL', 'VERIFICACION'].includes(filters.location)) {
    expedientFilter.currentLocation = filters.location as Prisma.ExpedientWhereInput['currentLocation']
  }
  const where: Prisma.ContractWhereInput = {
    ...contractAccessWhere(user),
    ...(filters.search ? {
      OR: [
        { customer: { name: { contains: filters.search, mode: 'insensitive' as const } } },
        { customer: { dni: { contains: filters.search, mode: 'insensitive' as const } } },
        { user: { name: { contains: filters.search, mode: 'insensitive' as const } } }
      ]
    } : {}),
    ...(filters.holderName || filters.holderDni ? {
      customer: {
        ...(filters.holderName ? { name: { contains: filters.holderName, mode: 'insensitive' as const } } : {}),
        ...(filters.holderDni ? { dni: { contains: filters.holderDni, mode: 'insensitive' as const } } : {})
      }
    } : {}),
    ...(filters.advisorName ? { user: { name: { contains: filters.advisorName, mode: 'insensitive' as const } } } : {}),
    ...(missingExpedient ? { expedient: { is: null } } : Object.keys(expedientFilter).length ? { expedient: expedientFilter } : {}),
    ...statusFilter
  }
  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { registeredAt: 'desc' },
    include: {
      customer: true,
      user: { select: { name: true, teamMemberships: { include: { team: { include: { site: true } } } } } },
      otherData: true,
      strategyDefinition: { select: { name: true } },
      expedient: true
    }
  })
  return { filename: 'matriculas_brighton', sheetName: 'Matrículas', columns: columnsFor(role), rows: contracts.map(rowFor) }
}

export type { ExportRole }
