import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getAccessibleContract, requireExpedientUser, safeRelativePath, uploadRoot } from '../../../../utils/expedients'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  const documentId = getRouterParam(event, 'documentId')
  if (!expedientId || !documentId || !/^[0-9a-f-]{36}$/i.test(expedientId) || !/^[0-9a-f-]{36}$/i.test(documentId)) throw createError({ statusCode: 400, statusMessage: 'Documento inválido' })
  const document = await prisma.expedientDocument.findFirst({ where: { id: documentId, expedientId }, include: { expedient: { include: { contract: { select: { id: true } } } } } })
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Documento no encontrado' })
  await getAccessibleContract(document.expedient.contract.id, user)
  const file = await readFile(join(uploadRoot(), safeRelativePath(document.filePath))).catch(() => null)
  if (!file) throw createError({ statusCode: 404, statusMessage: 'Archivo no encontrado en el almacenamiento' })
  setHeader(event, 'Content-Type', document.mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${document.fileName.replace(/[\r\n"]/g, '')}"`)
  return file
})
