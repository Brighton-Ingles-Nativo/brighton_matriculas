import { assertCsrf } from '../../utils/auth'
import { notify } from '../../utils/notifications'
import { prisma } from '../../utils/prisma'
import { getAccessibleContract, requireExpedientUser, removeStoredFile, storeUpload, type ExpedientDocumentType } from '../../utils/expedients'

const filePart = (parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) => parts?.find((part) => part.name === name && part.data?.length)

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const parts = await readMultipartFormData(event)
  const contractId = String(parts?.find((part) => part.name === 'contractId')?.data?.toString() || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(contractId)) throw createError({ statusCode: 400, statusMessage: 'Matrícula inválida' })

  const contract = await getAccessibleContract(contractId, user)
  if (!contract.signedAt) throw createError({ statusCode: 409, statusMessage: 'El expediente se puede crear cuando el contrato esté firmado.' })

  const dni = filePart(parts, 'dni')
  const voucher = filePart(parts, 'voucher')
  const additional = filePart(parts, 'additional')
  if (!dni || !voucher) throw createError({ statusCode: 400, statusMessage: 'El DNI y el voucher son obligatorios.' })

  const uploaded: Array<{ type: ExpedientDocumentType; file: NonNullable<typeof dni> }> = [
    { type: 'DNI', file: dni },
    { type: 'VOUCHER', file: voucher },
    ...(additional ? [{ type: 'ADICIONAL' as const, file: additional }] : [])
  ]
  let stored: Array<{ type: ExpedientDocumentType; data: Awaited<ReturnType<typeof storeUpload>> }> = []

  try {
    for (const { type, file } of uploaded) {
      stored.push({ type, data: await storeUpload(contractId, file) })
    }
    const existing = await prisma.expedient.findUnique({ where: { contractId }, include: { documents: true } })
    const expedient = await prisma.$transaction(async (tx) => {
      const initialLocation = user.role?.name === 'asesor' ? 'SUPERVISOR' : 'ASISTENTE_COMERCIAL' as const
      const current = existing
        ? await tx.expedient.update({ where: { id: existing.id }, data: { status: 'CREADO' } })
        : await tx.expedient.create({ data: { contractId, status: 'CREADO', currentLocation: initialLocation } })
      await tx.expedientMovement.create({
        data: {
          expedientId: current.id,
          fromStatus: existing?.status ?? null,
          toStatus: current.status,
          fromLocation: existing?.currentLocation ?? null,
          toLocation: current.currentLocation,
          userId: user.id,
          observation: existing ? 'Expediente actualizado por carga de documentos.' : 'Expediente creado.'
        }
      })
      for (const document of stored) {
        const previous = existing?.documents.find((item) => item.type === document.type)
        if (previous) await tx.expedientDocument.delete({ where: { id: previous.id } })
        await tx.expedientDocument.create({ data: { expedientId: current.id, type: document.type, ...document.data } })
      }
      return current
    })
    for (const previous of existing?.documents || []) {
      if (stored.some((document) => document.type === previous.type)) {
        await removeStoredFile(previous.filePath)
      }
    }
    const reviewers = await prisma.user.findMany({ where: { active: true, role: { name: { in: ['asistente_comercial', 'verificador'] } } }, select: { id: true } })
    await notify({
      recipients: reviewers.map((reviewer) => reviewer.id),
      type: 'EXPEDIENTE_PENDIENTE_REVISION',
      title: 'Nuevo expediente pendiente de revisión',
      message: 'Se ha creado o actualizado un expediente que requiere revisión.',
      entityType: 'EXPEDIENT',
      entityId: expedient.id,
      actionUrl: `/expedientes/${expedient.id}`,
      priority: 'high',
      dedupeKey: `expedient:${expedient.id}:pending:${expedient.updatedAt.toISOString()}`
    })
    return { success: true, data: { id: expedient.id } }
  } catch (error) {
    await Promise.all(stored.map((document) => removeStoredFile(document.data.filePath)))
    throw error
  }
})
