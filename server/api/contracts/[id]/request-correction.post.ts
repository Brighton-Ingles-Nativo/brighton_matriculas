import { randomUUID } from 'node:crypto'
import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { isContractSigned } from '../../../utils/contract-signature'
import { notify } from '../../../utils/notifications'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  if (user.role?.name !== 'verificador') {
    throw createError({ statusCode: 403, message: 'Solo Verificación puede solicitar correcciones.' })
  }

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, message: 'ID de matrícula inválido' })
  }

  const body = await readBody<{ message?: unknown }>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'Datos de la solicitud inválidos.' })
  }

  if (body.message !== undefined && body.message !== null && typeof body.message !== 'string') {
    throw createError({ statusCode: 400, message: 'El mensaje de corrección no es válido.' })
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length > 1000) {
    throw createError({ statusCode: 400, message: 'El mensaje no puede superar los 1000 caracteres.' })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, contractNumber: true, userId: true, status: true, signedAccept: true, signedAt: true }
  })
  if (!contract) throw createError({ statusCode: 404, message: 'Matrícula no encontrada' })
  if (contract.status !== 'REVISION') {
    throw createError({ statusCode: 409, message: 'Solo se pueden solicitar correcciones mientras la matrícula está en revisión.' })
  }
  if (isContractSigned(contract)) {
    throw createError({ statusCode: 409, message: 'La matrícula ya fue firmada y no puede corregirse. Debe tramitarse una solicitud de anulación.' })
  }

  await notify({
    recipients: [contract.userId],
    type: 'CONTRATO_CORRECCION_SOLICITADA',
    title: 'Corrección solicitada en una matrícula',
    message: message
      ? `La matrícula ${contract.contractNumber} requiere corrección. Mensaje de Verificación: ${message}`
      : `La matrícula ${contract.contractNumber} requiere una corrección. Revisa los datos y actualiza el registro.`,
    entityType: 'CONTRACT',
    entityId: contract.id,
    actionUrl: `/matricula/${contract.id}`,
    priority: 'high',
    data: { requestedByUserId: user.id, correctionMessage: message || null },
    dedupeKey: `contract:${contract.id}:correction-request:${randomUUID()}`
  })

  return { success: true, message: 'Solicitud de corrección enviada al asesor. La matrícula sigue en revisión.' }
})
