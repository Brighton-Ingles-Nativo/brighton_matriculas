import { getAccessibleContract, requireExpedientUser } from '../../../../../utils/expedients'
import { prisma } from '../../../../../utils/prisma'
import { getS3ObjectBuffer } from '../../../../../utils/s3'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  const documentId = getRouterParam(event, 'documentId')
  if (!expedientId || !documentId || !/^[0-9a-f-]{36}$/i.test(expedientId) || !/^[0-9a-f-]{36}$/i.test(documentId)) {
    throw createError({ statusCode: 400, message: 'Documento inválido' })
  }

  const document = await prisma.expedientDocument.findFirst({
    where: { id: documentId, expedientId },
    select: { filePath: true, fileName: true, mimeType: true, expedient: { select: { contractId: true } } }
  })
  if (!document) throw createError({ statusCode: 404, message: 'Documento no encontrado' })
  await getAccessibleContract(document.expedient.contractId, user)

  const file = await getS3ObjectBuffer(document.filePath)
  setHeader(event, 'Content-Type', document.mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${document.fileName.replace(/[\r\n"]/g, '')}"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return file
})
