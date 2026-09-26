import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getUserBySession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })

  const source = await readFile(join(process.cwd(), 'old_system', 'detalle.php'), 'utf8')
  const start = source.indexOf('<h5 style="text-align: center; line-height: 1.5">')
  const end = source.indexOf('<?php if (!$c[\'acepto\']): ?>', start)
  return { success: true, html: start >= 0 && end > start ? source.slice(start, end).trim() : '<p>Los términos y condiciones no están disponibles.</p>' }
})
