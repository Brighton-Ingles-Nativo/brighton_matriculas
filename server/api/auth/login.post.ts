import type { AuthResponse, LoginRequest } from '~/shared/types/auth'
import { prisma } from '../../utils/prisma'
import { assertCsrf, cleanExpiredSessions, createUserSession, getClientIPAddress, parsePermissions, setSessionCookie, verifyPassword } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  try {
    const body = await readBody<LoginRequest>(event)
    if (!body.username || !body.password) {
      return { success: false, message: 'Usuario y contraseña son obligatorios' } as AuthResponse
    }

    await cleanExpiredSessions()
    const user = await prisma.user.findFirst({
      where: { active: true, OR: [{ username: body.username }, { email: body.username }] },
      include: { role: true }
    })

    if (!user || !(await verifyPassword(body.password, user.password))) {
      return { success: false, message: 'Credenciales inválidas' } as AuthResponse
    }

    const session = await createUserSession(user.id, body.rememberMe || false, getClientIPAddress(event), getHeader(event, 'user-agent'))
    setSessionCookie(event, session.token, session.expiresAt)

    return {
      success: true,
      message: 'Login exitoso',
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
    console.error('Error en login:', error)
    return { success: false, message: 'Error interno del servidor' } as AuthResponse
  }
})
