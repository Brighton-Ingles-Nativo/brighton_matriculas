import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { isStrategyId, normalizeStrategyCode, normalizeStrategyName } from '../../../utils/strategies'

const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

const descriptionValue = (value: unknown): string | null => {
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: 'La descripción debe ser texto.' })
  const description = value.trim()
  if (description.length > 2000) throw createError({ statusCode: 400, statusMessage: 'La descripción no puede exceder 2000 caracteres.' })
  return description || null
}

const displayOrderValue = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100000) {
    throw createError({ statusCode: 400, statusMessage: 'El orden debe ser un número entero entre 0 y 100000.' })
  }
  return value
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  assertCsrf(event)
  const id = getRouterParam(event, 'id') || ''
  if (!isStrategyId(id)) throw createError({ statusCode: 400, statusMessage: 'Estrategia inválida.' })

  const body = await readBody<Record<string, unknown>>(event)
  const data: Record<string, unknown> = { updatedById: admin.id }

  if (hasOwn(body, 'name')) {
    const name = normalizeStrategyName(body.name)
    if (name.length < 2 || name.length > 150) {
      throw createError({ statusCode: 400, statusMessage: 'El nombre de la estrategia debe tener entre 2 y 150 caracteres.' })
    }
    data.name = name
  }
  if (hasOwn(body, 'code')) data.code = normalizeStrategyCode(body.code)
  if (hasOwn(body, 'description')) data.description = descriptionValue(body.description)
  if (hasOwn(body, 'active')) {
    if (typeof body.active !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'El estado activo debe ser verdadero o falso.' })
    data.active = body.active
  }
  if (hasOwn(body, 'displayOrder')) data.displayOrder = displayOrderValue(body.displayOrder)

  try {
    const strategy = await prisma.strategy.update({ where: { id }, data })
    return { success: true, data: strategy }
  } catch (error: any) {
    if (error?.code === 'P2025') throw createError({ statusCode: 404, statusMessage: 'Estrategia no encontrada.' })
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe una estrategia con ese nombre o código.' })
    throw error
  }
})
