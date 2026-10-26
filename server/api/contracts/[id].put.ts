import type { Prisma } from '@prisma/client'
import { assertCsrf, getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { resolveActiveStrategy } from '../../utils/strategies'
import { assertContractAccess } from '../../utils/contract-access'
import { isContractSigned } from '../../utils/contract-signature'
import { notify } from '../../utils/notifications'
import { MATRICULA_PROGRAM } from '../../../app/utils/matricula-pricing'

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const optionalText = (value: unknown) => text(value) || null
const optionalAmountText = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  const amount = Number(raw)
  return raw && Number.isFinite(amount) && amount >= 0 ? raw : null
}
const dateValue = (value: unknown) => { const raw = text(value); if (!raw) return null; const date = new Date(`${raw}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? null : date }
const money = (value: unknown) => { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : 0 }

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, message: 'ID de matrícula inválido' })

  const contract = await prisma.contract.findUnique({ where: { id }, select: {
    id: true, contractNumber: true, userId: true, customerId: true, status: true, signedAccept: true, signedAt: true, strategyNameSnapshot: true,
    strategyDefinition: { select: { name: true } }
  } })
  if (!contract) throw createError({ statusCode: 404, message: 'Matrícula no encontrada' })
  if (isContractSigned(contract) || contract.status === 'ANULADO') {
    throw createError({ statusCode: 409, message: 'No se puede editar una matrícula firmada.' })
  }
  if (!['admin', 'asesor', 'supervisor', 'verificador'].includes(user.role?.name || '')) throw createError({ statusCode: 403, message: 'No tienes permiso para editar matrículas' })
  await assertContractAccess(user, id)
  if (user.role?.name === 'asesor' && contract.userId !== user.id) throw createError({ statusCode: 403, message: 'No tienes acceso a esta matrícula' })

  const body = await readBody<Record<string, unknown>>(event)
  const strategyIdProvided = Object.prototype.hasOwnProperty.call(body, 'strategyId')
  const selectedStrategy = strategyIdProvided ? await resolveActiveStrategy(body.strategyId) : null
  const strategyName = selectedStrategy?.name || contract.strategyNameSnapshot || contract.strategyDefinition?.name || ''
  const required = ['contractDepartment', 'contractProvince', 'contractDistrict', 'holderName', 'holderBirthDate', 'holderDni', 'holderEmail', 'holderAddress', 'holderDepartment', 'holderProvince', 'holderDistrict', 'holderPhone', 'modality', 'program', 'paymentMode', 'programValue']
  const missing = required.find((field) => !text(body[field]))
  if (missing) throw createError({ statusCode: 400, message: `El campo ${missing} es obligatorio.` })
  if (strategyIdProvided && !selectedStrategy) throw createError({ statusCode: 400, message: 'La estrategia seleccionada es obligatoria.' })
  if (!body.dataAuthorization) throw createError({ statusCode: 400, message: 'La autorización de datos personales es obligatoria.' })
  if (text(body.program) !== MATRICULA_PROGRAM) throw createError({ statusCode: 400, message: 'El programa seleccionado no es válido.' })
  if (!text(body.plan)) throw createError({ statusCode: 400, message: 'El plan es obligatorio.' })

  const paymentMode = text(body.paymentMode)
  const studentInputs = Array.isArray(body.students)
    ? body.students as Array<Record<string, unknown>>
    : []
  const students = studentInputs.map((student) => ({
    name: text(student.name), birthDate: dateValue(student.birthDate), dni: optionalText(student.dni),
    email: optionalText(student.email), phone: optionalText(student.phone)
  })).filter((student) => student.name)
  const holder = {
    name: text(body.holderName), birthDate: dateValue(body.holderBirthDate)!, dni: text(body.holderDni),
    email: text(body.holderEmail), address: text(body.holderAddress), department: optionalText(body.holderDepartment),
    province: optionalText(body.holderProvince), district: optionalText(body.holderDistrict), phone: text(body.holderPhone)
  }

  const updatedContract = await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: contract.customerId }, data: holder })
    const updated = await tx.contract.update({ where: { id }, data: {
      contractDepartment: text(body.contractDepartment), contractProvince: text(body.contractProvince), contractDistrict: text(body.contractDistrict),
      paymentStartDate: optionalText(body.paymentStartDate), modality: text(body.modality), program: text(body.program),
      plan: optionalText(body.plan), cashPayment: paymentMode === 'contado',
      financedPayment: paymentMode === 'financiado', programValue: money(body.programValue), initialPayment: money(body.initialPayment),
      balance: money(body.balance), installmentCount: Math.max(0, Math.trunc(Number(body.installmentCount) || 0)),
      installmentValue: money(body.installmentValue), otherPayment: optionalAmountText(body.otherPayment),
      ...(strategyIdProvided ? { strategyId: selectedStrategy?.id, strategyNameSnapshot: strategyName } : {}),
      students: { deleteMany: {} }
    }, select: { status: true, updatedAt: true } })
    await tx.contractOtherData.upsert({ where: { contractId: id }, create: {
      contractId: id, currentSituation: text(body.currentSituation) || 'Empleado', housingType: text(body.housingType) || 'Propia',
      strategy: strategyName, notes: optionalText(body.notes), dataAuthorization: Boolean(body.dataAuthorization),
      testimonials: Boolean(body.testimonials), dataUsage: Boolean(body.dataUsage)
    }, update: {
      currentSituation: text(body.currentSituation) || 'Empleado', housingType: text(body.housingType) || 'Propia',
      strategy: strategyName, notes: optionalText(body.notes), dataAuthorization: Boolean(body.dataAuthorization),
      testimonials: Boolean(body.testimonials), dataUsage: Boolean(body.dataUsage)
    } })
    const seen = new Set<string>()
    for (const student of students) {
      const existing = student.dni ? await tx.student.findFirst({ where: { customerId: contract.customerId, dni: student.dni } }) : null
      const saved = existing
        ? await tx.student.update({ where: { id: existing.id }, data: student, select: { id: true } })
        : await tx.student.create({ data: { customerId: contract.customerId, ...student }, select: { id: true } })
      if (!seen.has(saved.id)) {
        await tx.contractStudent.create({ data: { contractId: id, studentId: saved.id } })
        seen.add(saved.id)
      }
    }

    return updated
  })

  let verificationNotificationPending = false
  if (updatedContract.status === 'REVISION' && user.role?.name !== 'verificador') {
    try {
      const correctionRequests = await prisma.notification.findMany({
        where: {
          recipientId: contract.userId,
          type: 'CONTRATO_CORRECCION_SOLICITADA',
          entityType: 'CONTRACT',
          entityId: contract.id
        },
        select: { id: true, data: true },
        orderBy: { createdAt: 'desc' }
      })

      // The existing notification metadata ties each open correction request to its verifier.
      const pendingRequests = correctionRequests.flatMap((request) => {
        if (!request.data || typeof request.data !== 'object' || Array.isArray(request.data)) return []
        const metadata = request.data as Record<string, unknown>
        const requestedByUserId = metadata.requestedByUserId
        if (typeof requestedByUserId !== 'string' || metadata.resolvedAt) return []
        return [{ id: request.id, requestedByUserId, metadata }]
      })
      const verifierIds = [...new Set(pendingRequests.map((request) => request.requestedByUserId))]

      if (pendingRequests.length && verifierIds.length) {
        try {
          await notify({
            recipients: verifierIds,
            type: 'CONTRATO_CORRECCION_RECIBIDA',
            title: 'Matrícula actualizada para revisión',
            message: `La matrícula ${contract.contractNumber} fue actualizada por ${user.name} después de una solicitud de corrección y está lista para una nueva revisión.`,
            entityType: 'CONTRACT',
            entityId: contract.id,
            actionUrl: `/matriculas?contractId=${contract.id}`,
            priority: 'high',
            data: { status: updatedContract.status, updatedByUserId: user.id },
            dedupeKey: `contract:${contract.id}:correction-received:${pendingRequests[0].id}`
          })
        } catch (error) {
          verificationNotificationPending = true
          console.error('[contracts] failed to notify verification after correction', { contractId: contract.id, error })
        }

        if (!verificationNotificationPending) {
          const resolvedAt = updatedContract.updatedAt.toISOString()
          try {
            await prisma.$transaction(pendingRequests.map((request) => prisma.notification.update({
              where: { id: request.id },
              data: { data: { ...request.metadata, resolvedAt } as Prisma.InputJsonValue }
            })))
          } catch (error) {
            console.error('[contracts] failed to close correction request after notifying verification', { contractId: contract.id, error })
          }
        }
      }
    } catch (error) {
      verificationNotificationPending = true
      console.error('[contracts] failed to notify verification after correction', { contractId: contract.id, error })
    }
  }

  return {
    success: true,
    message: 'Matrícula actualizada correctamente',
    data: { verificationNotificationPending }
  }
})
