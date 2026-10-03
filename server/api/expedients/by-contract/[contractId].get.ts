import { requireExpedientUser, getAccessibleContract } from '../../../utils/expedients'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const contractId = getRouterParam(event, 'contractId')
  if (!contractId || !/^[0-9a-f-]{36}$/i.test(contractId)) throw createError({ statusCode: 400, statusMessage: 'Matrícula inválida' })
  await getAccessibleContract(contractId, user)
  const expedient = await prisma.expedient.findUnique({ where: { contractId }, include: { documents: { orderBy: { uploadedAt: 'asc' } } } })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  return { success: true, data: { id: expedient.id, status: expedient.status, currentLocation: expedient.currentLocation, responsibleId: expedient.responsibleId, documents: expedient.documents.map((document) => ({ id: document.id, type: document.type, fileName: document.fileName, mimeType: document.mimeType, fileSize: document.fileSize, uploadedAt: document.uploadedAt, downloadUrl: `/api/expedients/${expedient.id}/documents/${document.id}` })) } }
})
