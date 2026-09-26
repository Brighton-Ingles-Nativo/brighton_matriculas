import type { ChangePasswordRequest, AuthResponse } from '~/shared/types/auth'
import { prisma } from '../../utils/prisma'
import { assertCsrf, getUserBySession, verifyPassword, hashPassword } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  try {
    const currentUser = await getUserBySession(event)

    if (!currentUser) {
      return {
        success: false,
        message: 'Sesión inválida o expirada'
      } as AuthResponse
    }

    const body = await readBody<ChangePasswordRequest>(event)

    // Validaciones básicas
    if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
      return {
        success: false,
        message: 'Todos los campos son obligatorios'
      } as AuthResponse
    }

    // Verificar que las nuevas contraseñas coincidan
    if (body.newPassword !== body.confirmPassword) {
      return {
        success: false,
        message: 'Las nuevas contraseñas no coinciden'
      } as AuthResponse
    }

    // Validar longitud de nueva contraseña
    if (body.newPassword.length < 6) {
      return {
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      } as AuthResponse
    }

    // Obtener contraseña actual del usuario
    const userWithPassword = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { password: true }
    })

    if (!userWithPassword) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      } as AuthResponse
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await verifyPassword(body.currentPassword, userWithPassword.password)
    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: 'La contraseña actual es incorrecta'
      } as AuthResponse
    }

    // Verificar que la nueva contraseña sea diferente a la actual
    const isSamePassword = await verifyPassword(body.newPassword, userWithPassword.password)
    if (isSamePassword) {
      return {
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual'
      } as AuthResponse
    }

    // Hashear nueva contraseña
    const hashedNewPassword = await hashPassword(body.newPassword)

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: hashedNewPassword }
    })

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente'
    } as AuthResponse

  } catch (error) {
    console.error('Error cambiando contraseña:', error)
    return {
      success: false,
      message: 'Error interno del servidor'
    } as AuthResponse
  }
})
