export interface User {
  id: string
  username: string
  email: string
  name: string
  pic_user?: string
  active: boolean
  email_verified: boolean
  role_id: string
  created_at: Date
  updated_at: Date
  role?: Role
}

export interface Role {
  id: string
  name: string
  permissions: Record<string, boolean>
  created_at: Date
}

export interface UserSession {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  last_seen_at: Date
  remember_me: boolean
  created_at: Date
  ip_address?: string
  user_agent?: string
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  name: string
  role_id?: string
}

export interface UpdateProfileRequest {
  username?: string
  email?: string
  name?: string
  pic_user?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AuthResponse {
  success: boolean
  message: string
  user?: User
}
