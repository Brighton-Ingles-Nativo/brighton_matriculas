import type { AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '~/shared/types/auth'

interface CsrfResponse {
  token: string
}

export const useAuth = () => {
  const user = useState<User | null>('auth.user', () => null)
  const csrfToken = useState<string | null>('auth.csrf', () => null)
  const isInitializing = useState<boolean>('auth.initializing', () => false)
  const isLoggedIn = computed(() => !!user.value)

  const setInitialized = () => {
    isInitializing.value = false
  }

  const ensureCsrfToken = async (): Promise<string> => {
    if (csrfToken.value) return csrfToken.value
    const response = await $fetch<CsrfResponse>('/api/auth/csrf', { credentials: 'include' })
    csrfToken.value = response.token
    return response.token
  }

  const csrfHeaders = async (): Promise<Record<string, string>> => ({
    'x-csrf-token': await ensureCsrfToken()
  })

  const verifyToken = async (): Promise<boolean> => {
    try {
      const response = await $fetch<AuthResponse>('/api/auth/me', { credentials: 'include' })
      if (response.success && response.user) {
        user.value = response.user
        return true
      }
    } catch {
      // La sesión no existe o ya expiró.
    }
    user.value = null
    return false
  }

  const initAuth = async () => {
    if (!import.meta.client) return
    isInitializing.value = true
    try {
      await ensureCsrfToken()
      await verifyToken()
    } catch {
      user.value = null
    } finally {
      isInitializing.value = false
    }
  }

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      const response = await $fetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        headers: await csrfHeaders(),
        credentials: 'include',
        body: credentials
      })
      if (response.success && response.user) user.value = response.user
      return response
    } catch {
      return { success: false, message: 'Error de conexión' }
    }
  }

  const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
      return await $fetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        headers: await csrfHeaders(),
        credentials: 'include',
        body: userData
      })
    } catch {
      return { success: false, message: 'Error de conexión' }
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        headers: await csrfHeaders(),
        credentials: 'include'
      })
    } finally {
      user.value = null
    }
  }

  const hasPermission = (permission: string): boolean => user.value?.role?.permissions?.[permission] || false
  const hasRole = (roleName: string): boolean => user.value?.role?.name === roleName

  const updateProfile = async (profileData: UpdateProfileRequest): Promise<AuthResponse> => {
    try {
      const response = await $fetch<AuthResponse>('/api/auth/update-profile', {
        method: 'PUT',
        headers: await csrfHeaders(),
        credentials: 'include',
        body: profileData
      })
      if (response.success && response.user) user.value = response.user
      return response
    } catch {
      return { success: false, message: 'Error de conexión' }
    }
  }

  const changePassword = async (passwordData: ChangePasswordRequest): Promise<AuthResponse> => {
    try {
      return await $fetch<AuthResponse>('/api/auth/change-password', {
        method: 'PUT',
        headers: await csrfHeaders(),
        credentials: 'include',
        body: passwordData
      })
    } catch {
      return { success: false, message: 'Error de conexión' }
    }
  }

  return {
    user: readonly(user),
    isLoggedIn,
    isInitializing: readonly(isInitializing),
    initAuth,
    verifyToken,
    csrfHeaders,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    hasPermission,
    hasRole,
    setInitialized
  }
}
