import { requireAdmin, assertCsrf, hashPassword, parsePermissions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event); assertCsrf(event)
  const id = getRouterParam(event, 'id'); const body = await readBody<Record<string, unknown>>(event)
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de usuario inválido' })
  if (id === admin.id && body.active === false) throw createError({ statusCode: 400, statusMessage: 'No puedes desactivar tu propio usuario.' })
  const roleName = body.role === undefined ? undefined : String(body.role)
  const role = roleName ? await prisma.role.findUnique({ where: { name: roleName } }) : null
  if (roleName && !role) throw createError({ statusCode: 400, statusMessage: 'El rol seleccionado no existe.' })
  const data: any = {}
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.username !== undefined) data.username = String(body.username).trim()
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase()
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (role) data.roleId = role.id
  if (body.password) { if (String(body.password).length < 6) throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 6 caracteres.' }); data.password = await hashPassword(String(body.password)) }
  try {
    const user = await prisma.user.update({ where: { id }, data, include: { role: true } })
    if (body.active === false) await prisma.userSession.deleteMany({ where: { userId: id } })
    return { success: true, data: { id: user.id, name: user.name, username: user.username, email: user.email, active: user.active, emailVerified: user.emailVerified, createdAt: user.createdAt, role: { id: user.role.id, name: user.role.name, permissions: parsePermissions(user.role.permissions) } } }
  } catch (error: any) { if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'El usuario o correo ya existe.' }); throw error }
})
