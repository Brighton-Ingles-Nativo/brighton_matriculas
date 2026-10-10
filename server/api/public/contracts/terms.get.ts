import { TERMS_HTML } from '../../../utils/terms'

export default defineEventHandler(async () => {
  return { success: true, html: TERMS_HTML }
})
