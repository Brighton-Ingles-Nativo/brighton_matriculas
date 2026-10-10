import { randomBytes } from 'node:crypto'
import { assertCsrf, getUserBySession } from '../../../utils/auth'
import { assertContractAccess } from '../../../utils/contract-access'
import { prisma } from '../../../utils/prisma'

const PUBLIC_LINK_TTL_MS = 5 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de matrícula inválido' })

  const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true } })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  await assertContractAccess(user, id)

  const token = randomBytes(32).toString('hex')
  const tokenExpiresAt = new Date(Date.now() + PUBLIC_LINK_TTL_MS)
  await prisma.contract.update({ where: { id }, data: { accessToken: token, tokenExpiresAt } })

  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl || '').replace(/\/$/, '') || getRequestURL(event).origin
  return {
    success: true,
    url: `${baseUrl}/contrato/publico?id=${id}&token=${token}`,
    tokenExpiresAt
  }
})
