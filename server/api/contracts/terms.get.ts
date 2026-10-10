import { getUserBySession } from '../../utils/auth'
import { TERMS_HTML } from '../../utils/terms'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })

  return { success: true, html: TERMS_HTML }
})
