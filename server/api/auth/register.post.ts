import type { AuthResponse, RegisterRequest } from '~/shared/types/auth'
import { prisma } from '../../utils/prisma'
import { assertCsrf, hashPassword, parsePermissions } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  try {
    const body = await readBody<RegisterRequest>(event)
    if (!body.username || !body.email || !body.password || !body.name) {
      return { success: false, message: 'Todos los campos son obligatorios' } as AuthResponse
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return { success: false, message: 'Formato de email inválido' } as AuthResponse
    }
    if (body.password.length < 6) {
      return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' } as AuthResponse
    }

    const existingUser = await prisma.user.findFirst({ where: { OR: [{ username: body.username }, { email: body.email }] } })
    if (existingUser) return { success: false, message: 'El usuario o email ya existe' } as AuthResponse

    const role = await prisma.role.findUnique({ where: { name: 'user' } })
    if (!role) return { success: false, message: 'Error de configuración: rol por defecto no encontrado' } as AuthResponse

    const user = await prisma.user.create({
      data: { username: body.username, email: body.email, password: await hashPassword(body.password), name: body.name, roleId: body.role_id || role.id },
      include: { role: true }
    })

    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        pic_user: user.picUser ?? undefined,
        active: user.active,
        email_verified: user.emailVerified,
        role_id: user.roleId,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        role: { id: user.role.id, name: user.role.name, permissions: parsePermissions(user.role.permissions), created_at: user.role.createdAt }
      }
    } as AuthResponse
  } catch (error) {
    console.error('Error en registro:', error)
    return { success: false, message: 'Error interno del servidor' } as AuthResponse
  }
})
