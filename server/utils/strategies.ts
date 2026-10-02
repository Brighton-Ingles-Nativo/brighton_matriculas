import { prisma } from './prisma'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isStrategyId = (value: string): boolean => UUID_PATTERN.test(value)

export const normalizeStrategyName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''

export const normalizeStrategyCode = (value: unknown): string | null => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!code) return null
  if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'El código debe usar solo letras, números, guiones o guiones bajos (máximo 50 caracteres).' })
  }
  return code
}

export async function resolveActiveStrategy(value: unknown): Promise<{ id: string; name: string } | null> {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) return null
  if (!isStrategyId(id)) throw createError({ statusCode: 400, statusMessage: 'La estrategia seleccionada no es válida.' })

  const strategy = await prisma.strategy.findFirst({
    where: { id, active: true },
    select: { id: true, name: true }
  })
  if (!strategy) throw createError({ statusCode: 400, statusMessage: 'La estrategia seleccionada no existe o está inactiva.' })
  return strategy
}
