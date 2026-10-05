import { assertCsrf } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { getAccessibleContract, requireExpedientUser, removeStoredFile } from '../../../../utils/expedients'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await requireExpedientUser(event)
  const expedientId = getRouterParam(event, 'id')
  const documentId = getRouterParam(event, 'documentId')
  if (!expedientId || !documentId || !/^[0-9a-f-]{36}$/i.test(expedientId) || !/^[0-9a-f-]{36}$/i.test(documentId)) throw createError({ statusCode: 400, statusMessage: 'Documento inválido' })
  const document = await prisma.expedientDocument.findFirst({ where: { id: documentId, expedientId }, include: { expedient: { include: { contract: { select: { id: true } } } } } })
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Documento no encontrado' })
  await getAccessibleContract(document.expedient.contract.id, user)
  if (user.role?.name !== 'asesor' || document.expedient.currentLocation !== 'ASESOR') {
    throw createError({ statusCode: 403, statusMessage: 'Los documentos solo pueden modificarse cuando el expediente está con el asesor.' })
  }
  await prisma.expedientDocument.delete({ where: { id: documentId } })
  await removeStoredFile(document.filePath)
  return { success: true }
})
