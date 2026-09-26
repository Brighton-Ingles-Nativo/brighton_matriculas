import type { AuthResponse } from '~/shared/types/auth'
import { getUserBySession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserBySession(event)

    if (!user) {
      return {
        success: false,
        message: 'Sesión inválida o expirada'
      } as AuthResponse
    }

    return {
      success: true,
      message: 'Usuario autenticado',
      user
    } as AuthResponse

  } catch (error) {
    console.error('Error en verificación de usuario:', error)
    return {
      success: false,
      message: 'Error interno del servidor'
    } as AuthResponse
  }
})
