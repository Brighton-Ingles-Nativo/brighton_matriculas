import { assertCsrf, requireAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { normalizeStrategyCode, normalizeStrategyName } from '../../../utils/strategies'

const descriptionValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: 'La descripción debe ser texto.' })
  const description = value.trim()
  if (description.length > 2000) throw createError({ statusCode: 400, statusMessage: 'La descripción no puede exceder 2000 caracteres.' })
  return description || null
}

const displayOrderValue = (value: unknown): number => {
  if (value === undefined) return 0
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100000) {
    throw createError({ statusCode: 400, statusMessage: 'El orden debe ser un número entero entre 0 y 100000.' })
  }
  return value
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  assertCsrf(event)
  const body = await readBody<Record<string, unknown>>(event)
  const name = normalizeStrategyName(body.name)
  if (name.length < 2 || name.length > 150) {
    throw createError({ statusCode: 400, statusMessage: 'El nombre de la estrategia debe tener entre 2 y 150 caracteres.' })
  }
  if (body.active !== undefined && typeof body.active !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'El estado activo debe ser verdadero o falso.' })
  }

  try {
    const strategy = await prisma.strategy.create({
      data: {
        code: normalizeStrategyCode(body.code),
        name,
        description: descriptionValue(body.description),
        active: body.active ?? true,
        displayOrder: displayOrderValue(body.displayOrder),
        createdById: admin.id,
        updatedById: admin.id
      }
    })
    return { success: true, data: strategy }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'Ya existe una estrategia con ese nombre o código.' })
    throw error
  }
})
