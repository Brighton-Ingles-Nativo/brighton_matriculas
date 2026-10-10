import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { User } from '~/shared/types/auth'
import { prisma } from './prisma'

const SALT_ROUNDS = 12
const CSRF_HEADER = 'x-csrf-token'

type PermissionMap = Record<string, boolean>

function parsePermissions(value: unknown): PermissionMap {
  if (typeof value === 'string') {
    try { return parsePermissions(JSON.parse(value)) } catch { return {} }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    )
  }
  return {}
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function sessionCookieName(): string {
  const config = useRuntimeConfig()
  return String(config.sessionCookieName || 'brighton_session')
}

function csrfCookieName(): string {
  const config = useRuntimeConfig()
  return String(config.csrfCookieName || 'brighton_csrf')
}

function sessionExpiration(rememberMe: boolean): Date {
  const config = useRuntimeConfig()
  const amount = rememberMe
    ? Number(config.rememberSessionTtlDays || 30) * 24 * 60 * 60 * 1000
    : Number(config.sessionTtlHours || 24) * 60 * 60 * 1000
  return new Date(Date.now() + amount)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createUserSession(
  userId: string,
  rememberMe: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken()
  const expiresAt = sessionExpiration(rememberMe)

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      rememberMe,
      ipAddress,
      userAgent
    }
  })

  return { token, expiresAt }
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date): void {
  setCookie(event, sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, sessionCookieName(), { path: '/' })
}

export async function getUserBySessionToken(token: string | undefined, event?: H3Event): Promise<User | null> {
  if (!token) return null

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { role: true } } }
  })

  if (!session) return null

  const now = new Date()

  // La sesión no debe cerrarse por inactividad. `lastSeenAt` se conserva como
  // dato de actividad, pero la validez se determina por la expiración absoluta
  // de la sesión y el estado activo del usuario.
  if (session.expiresAt <= now || !session.user.active) {
    await prisma.userSession.deleteMany({ where: { id: session.id } })
    if (event) clearSessionCookie(event)
    return null
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now }
  })

  const user = session.user
  return {
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
    role: {
      id: user.role.id,
      name: user.role.name,
      permissions: parsePermissions(user.role.permissions),
      created_at: user.role.createdAt
    }
  }
}

export async function getUserBySession(event: H3Event): Promise<User | null> {
  return getUserBySessionToken(getCookie(event, sessionCookieName()), event)
}

export async function invalidateCurrentSession(event: H3Event): Promise<void> {
  const token = getCookie(event, sessionCookieName())
  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
  }
  clearSessionCookie(event)
}

export async function cleanExpiredSessions(): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  })
}

export function getClientIPAddress(event: H3Event): string {
  const forwarded = getHeader(event, 'x-forwarded-for')
  const realIP = getHeader(event, 'x-real-ip')
  const remoteAddress = event.node.req.socket?.remoteAddress
  const connection = event.node.req.connection?.remoteAddress
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return realIP || remoteAddress || connection || 'unknown'
}

export function ensureCsrfCookie(event: H3Event): string {
  const existing = getCookie(event, csrfCookieName())
  if (existing) return existing

  const token = randomToken()
  setCookie(event, csrfCookieName(), token, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/'
  })
  return token
}

export function assertCsrf(event: H3Event): void {
  const cookieToken = getCookie(event, csrfCookieName())
  const headerToken = getHeader(event, CSRF_HEADER)
  if (!cookieToken || !headerToken) {
    throw createError({ statusCode: 403, statusMessage: 'CSRF token requerido' })
  }

  const cookieBuffer = Buffer.from(cookieToken)
  const headerBuffer = Buffer.from(headerToken)
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    throw createError({ statusCode: 403, statusMessage: 'CSRF token inválido' })
  }
}

export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (user.role?.name !== 'admin' && !user.role?.permissions?.admin) {
    throw createError({ statusCode: 403, statusMessage: 'Se requieren permisos de administrador' })
  }
  return user
}

export { parsePermissions }
