import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async () => {
  const source = await readFile(join(process.cwd(), 'old_system', 'detalle_publico.php'), 'utf8')
  const start = source.indexOf('<h5 style="text-align: center; line-height: 1.5">')
  const end = source.indexOf('<?php if (!$c[\'acepto\']): ?>', start)
  return { success: true, html: start >= 0 && end > start ? source.slice(start, end).trim() : '<p>Los términos y condiciones no están disponibles.</p>' }
})
