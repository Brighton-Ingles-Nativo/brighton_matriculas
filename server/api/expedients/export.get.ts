import { getUserBySession } from '../../utils/auth'
import { renderExport } from '../../utils/exports/engine'
import { buildEnrollmentExport, type ExportRole } from '../../utils/exports/reports/enrollments'
import type { ExportFormat } from '../../utils/exports/types'

const exportRoles: ExportRole[] = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const role = user.role?.name as ExportRole | undefined
  if (!role || !exportRoles.includes(role)) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para exportar expedientes' })

  const query = getQuery(event)
  const format: ExportFormat = query.format === 'csv' ? 'csv' : 'xlsx'
  const document = await buildEnrollmentExport(user as { id: string; role: { name: string } }, {
    search: typeof query.search === 'string' ? query.search.trim() : undefined,
    expedientStatus: typeof query.status === 'string' ? query.status.trim() : undefined,
    location: typeof query.location === 'string' ? query.location.trim() : undefined
  })
  const output = renderExport({ ...document, filename: 'expedientes_brighton', sheetName: 'Expedientes' }, format)
  setHeader(event, 'Content-Type', output.contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="expedientes_brighton_${new Date().toISOString().slice(0, 10)}.${output.extension}"`)
  return output.body
})
