import { getUserBySession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de matrícula inválido' })

  const contract = await prisma.contract.findUnique({ where: { id }, select: { userId: true, accessToken: true, tokenExpiresAt: true } })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  if (user.role?.name === 'asesor' && contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta matrícula' })
  if (!contract.accessToken || !contract.tokenExpiresAt || contract.tokenExpiresAt <= new Date()) throw createError({ statusCode: 409, statusMessage: 'El enlace público ha expirado' })

  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl || '').replace(/\/$/, '') || getRequestURL(event).origin
  return { success: true, url: `${baseUrl}/contrato/publico?id=${id}&token=${contract.accessToken}` }
})
