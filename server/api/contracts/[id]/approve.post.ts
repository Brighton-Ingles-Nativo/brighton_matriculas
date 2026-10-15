import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { notify } from '../../../utils/notifications'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  if (user.role?.name !== 'verificador') {
    throw createError({ statusCode: 403, message: 'No tienes permiso para aprobar matrículas' })
  }

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, message: 'ID de matrícula inválido' })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      contractNumber: true,
      userId: true,
      status: true,
      user: { select: { supervisorId: true } }
    }
  })
  if (!contract) throw createError({ statusCode: 404, message: 'Matrícula no encontrada' })
  if (contract.status === 'ANULADO') {
    throw createError({ statusCode: 409, message: 'No se puede aprobar una matrícula anulada.' })
  }
  if (contract.status === 'APROBADO') {
    return { success: true, message: 'La matrícula ya está aprobada', data: { status: contract.status } }
  }
  if (contract.status !== 'REVISION') {
    throw createError({ statusCode: 409, message: 'La matrícula ya no está pendiente de revisión.' })
  }

  const updated = await prisma.contract.updateMany({
    where: { id, status: 'REVISION' },
    data: { status: 'APROBADO' }
  })
  if (!updated.count) {
    throw createError({ statusCode: 409, message: 'La matrícula cambió de estado. Actualiza la vista antes de aprobarla.' })
  }

  await notify({
    recipients: [contract.userId, contract.user.supervisorId ?? ''],
    type: 'CONTRATO_APROBADO',
    title: 'Matrícula aprobada',
    message: `La matrícula ${contract.contractNumber} fue aprobada por Verificación.`,
    entityType: 'CONTRACT',
    entityId: contract.id,
    actionUrl: `/matricula/${contract.id}`,
    priority: 'high',
    dedupeKey: `contract:${contract.id}:approved`
  })

  return { success: true, message: 'Matrícula aprobada correctamente', data: { status: 'APROBADO' as const } }
})
