import { assertCsrf } from '../../../utils/auth'
import { notify } from '../../../utils/notifications'
import { prisma } from '../../../utils/prisma'
import { getAccessibleContract, requireExpedientUser, removeStoredFile, storeUpload, validateDocumentType } from '../../../utils/expedients'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  if (!expedientId || !/^[0-9a-f-]{36}$/i.test(expedientId)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })
  const expedient = await prisma.expedient.findUnique({ where: { id: expedientId }, include: { contract: { select: { id: true, userId: true, signedAt: true } } } })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  await getAccessibleContract(expedient.contract.id, user)
  if (user.role?.name !== 'asesor' || expedient.currentLocation !== 'ASESOR') {
    throw createError({ statusCode: 403, statusMessage: 'Los documentos solo pueden modificarse cuando el expediente está con el asesor.' })
  }
  if (!expedient.contract.signedAt) throw createError({ statusCode: 409, statusMessage: 'El contrato aún no está firmado.' })

  const parts = await readMultipartFormData(event)
  const type = String(parts?.find((part) => part.name === 'type')?.data?.toString() || '').trim()
  validateDocumentType(type)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Debes seleccionar un archivo.' })
  const stored = await storeUpload(expedient.contract.id, file)
  const previous = await prisma.expedientDocument.findFirst({ where: { expedientId, type } })
  try {
    const document = await prisma.$transaction(async (tx) => {
      if (previous) await tx.expedientDocument.delete({ where: { id: previous.id } })
      const updated = await tx.expedient.update({ where: { id: expedientId }, data: { status: 'CREADO' } })
      await tx.expedientMovement.create({
        data: {
          expedientId,
          fromStatus: expedient.status,
          toStatus: updated.status,
          fromLocation: expedient.currentLocation,
          toLocation: updated.currentLocation,
          userId: user.id,
          observation: `Documento ${type} actualizado.`
        }
      })
      return tx.expedientDocument.create({ data: { expedientId, type, ...stored } })
    })
    if (previous) await removeStoredFile(previous.filePath)
    await notify({
      recipients: [expedient.contract.userId],
      type: 'EXPEDIENTE_DOCUMENTO_ACTUALIZADO',
      title: 'Documento de expediente actualizado',
      message: `Se actualizó el documento ${document.type} del expediente.`,
      entityType: 'EXPEDIENT',
      entityId: expedientId,
      actionUrl: `/expedientes/${expedientId}`,
      priority: 'normal',
      dedupeKey: `expedient:${expedientId}:document:${document.type}:${document.id}`
    })
    return { success: true, data: { id: document.id, type: document.type, fileName: document.fileName } }
  } catch (error) {
    await removeStoredFile(stored.filePath)
    throw error
  }
})
