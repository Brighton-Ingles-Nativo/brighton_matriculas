import { requireExpedientUser } from '../../utils/expedients'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Expediente inválido' })
  const expedient = await prisma.expedient.findUnique({ where: { id }, include: { contract: { select: { userId: true } }, documents: { orderBy: { uploadedAt: 'asc' } } } })
  if (!expedient) throw createError({ statusCode: 404, statusMessage: 'Expediente no encontrado' })
  if (user.role?.name === 'asesor' && expedient.contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este expediente' })
  return {
    success: true,
    data: {
      id: expedient.id,
      contractId: expedient.contractId,
      status: expedient.status,
      createdAt: expedient.createdAt,
      updatedAt: expedient.updatedAt,
      documents: expedient.documents.map((document) => ({
        id: document.id,
        type: document.type,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt,
        downloadUrl: `/api/expedients/${expedient.id}/documents/${document.id}`
      }))
    }
  }
})
