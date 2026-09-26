import { ensureCsrfCookie } from '../../utils/auth'

export default defineEventHandler((event) => ({
  token: ensureCsrfCookie(event)
}))
