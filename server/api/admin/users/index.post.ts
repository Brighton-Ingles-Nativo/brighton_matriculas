import { requireAdmin, assertCsrf, hashPassword, parsePermissions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event); assertCsrf(event)
  const body = await readBody<Record<string, unknown>>(event)
  const name = String(body.name || '').trim(); const username = String(body.username || '').trim(); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '')
  if (!name || !username || !email || password.length < 6) throw createError({ statusCode: 400, statusMessage: 'Nombre, usuario, correo y contraseña (mínimo 6 caracteres) son obligatorios.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'El correo no es válido.' })
  const role = await prisma.role.findUnique({ where: { name: String(body.role || 'user') } })
  if (!role) throw createError({ statusCode: 400, statusMessage: 'El rol seleccionado no existe.' })
  try {
    const user = await prisma.user.create({ data: { name, username, email, password: await hashPassword(password), roleId: role.id, active: body.active !== false }, include: { role: true } })
    return { success: true, data: { id: user.id, name: user.name, username: user.username, email: user.email, active: user.active, emailVerified: user.emailVerified, createdAt: user.createdAt, role: { id: user.role.id, name: user.role.name, permissions: parsePermissions(user.role.permissions) } } }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'El usuario o correo ya existe.' })
    throw error
  }
})
