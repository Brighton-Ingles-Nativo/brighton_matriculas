import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de recibo inválido' })
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { contract: true, user: { select: { name: true, username: true } } } })
  if (!receipt) throw createError({ statusCode: 404, statusMessage: 'Recibo no encontrado' })
  if (user.role?.name === 'asesor' && receipt.contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este recibo' })
  return { success: true, data: { ...receipt, amount: receipt.amount?.toString() ?? null, contract: { ...receipt.contract, programValue: receipt.contract.programValue.toString(), initialPayment: receipt.contract.initialPayment?.toString() ?? null, balance: receipt.contract.balance?.toString() ?? null } } }
})
