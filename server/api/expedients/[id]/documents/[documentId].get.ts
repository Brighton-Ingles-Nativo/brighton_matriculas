import { getAccessibleContract, requireExpedientUser } from '../../../../utils/expedients'
import { prisma } from '../../../../utils/prisma'
import { getS3DownloadUrl } from '../../../../utils/s3'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  const documentId = getRouterParam(event, 'documentId')
  if (!expedientId || !documentId || !/^[0-9a-f-]{36}$/i.test(expedientId) || !/^[0-9a-f-]{36}$/i.test(documentId)) throw createError({ statusCode: 400, statusMessage: 'Documento inválido' })
  const document = await prisma.expedientDocument.findFirst({ where: { id: documentId, expedientId }, include: { expedient: { include: { contract: { select: { id: true } } } } } })
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Documento no encontrado' })
  await getAccessibleContract(document.expedient.contract.id, user)
  const downloadUrl = await getS3DownloadUrl(document.filePath, document.mimeType, document.fileName)
  return sendRedirect(event, downloadUrl, 302)
})
