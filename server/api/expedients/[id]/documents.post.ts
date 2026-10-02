import { assertCsrf } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { getAccessibleContract, requireExpedientUser, removeStoredFile, storeUpload, validateDocumentType } from '../../../utils/expedients'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  if (!expedientId || !/^[0-9a-f-]{36}$/i.test(expedientId)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })
  const expedient = await prisma.expedient.findUnique({ where: { id: expedientId }, include: { contract: { select: { id: true, userId: true, accepted: true } } } })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  await getAccessibleContract(expedient.contract.id, user)
  if (!expedient.contract.accepted) throw createError({ statusCode: 409, statusMessage: 'El contrato aún no está firmado.' })

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
      await tx.expedient.update({ where: { id: expedientId }, data: { status: 'PENDIENTE' } })
      return tx.expedientDocument.create({ data: { expedientId, type, ...stored } })
    })
    if (previous) await removeStoredFile(previous.filePath)
    return { success: true, data: { id: document.id, type: document.type, fileName: document.fileName } }
  } catch (error) {
    await removeStoredFile(stored.filePath)
    throw error
  }
})
