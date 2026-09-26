import type { AuthResponse } from '~/shared/types/auth'
import { assertCsrf, invalidateCurrentSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  try {
    await invalidateCurrentSession(event)

    return {
      success: true,
      message: 'Logout exitoso'
    } as AuthResponse

  } catch (error) {
    console.error('Error en logout:', error)
    return {
      success: false,
      message: 'Error interno del servidor'
    } as AuthResponse
  }
})
