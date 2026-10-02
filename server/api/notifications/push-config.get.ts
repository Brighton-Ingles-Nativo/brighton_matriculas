import { getUserBySession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  return {
    success: true,
    enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
    publicKey: process.env.VAPID_PUBLIC_KEY || null
  }
})
