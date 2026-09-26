import { assertCsrf, getUserBySession } from '../utils/auth'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (!['admin', 'asesor'].includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para registrar recibos' })
  const body = await readBody<Record<string, unknown>>(event)
  const contractId = String(body.contractId || '')
  const amount = Number(body.amount)
  const concepts = String(body.concepts || '')
  const paymentMethod = String(body.paymentMethod || '')
  const transactionDate = String(body.transactionDate || '')
  if (!contractId || !Number.isFinite(amount) || amount <= 0 || !concepts || !paymentMethod || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) || (concepts === 'Otros' && !String(body.otherConcept || '').trim())) throw createError({ statusCode: 400, statusMessage: 'Completa los datos obligatorios del recibo.' })
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true, userId: true, status: true } })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  if (Number(contract.status) !== 1) throw createError({ statusCode: 403, statusMessage: 'Solo se puede generar recibos para matrículas revisadas.' })
  if (user.role?.name === 'asesor' && contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta matrícula' })
  const storedConcept = concepts === 'Otros' ? `OTROS: ${String(body.otherConcept).trim()}` : concepts.toUpperCase()
  const receipt = await prisma.receipt.create({ data: { contractId, userId: user.id, registeredRole: user.role?.name, amount, concepts: storedConcept, otherConcept: body.otherConcept ? String(body.otherConcept).trim() : null, paymentMethod, operationNumber: body.operationNumber ? String(body.operationNumber) : null, bank: body.bank ? String(body.bank) : null, transactionDate: new Date(`${transactionDate}T00:00:00.000Z`) } })
  return { success: true, data: { id: receipt.id } }
})
