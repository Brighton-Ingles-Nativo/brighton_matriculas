import { getUserBySession } from '../../utils/auth'
import { buildEnrollmentExport, type ExportRole } from '../../utils/exports/reports/enrollments'
import { renderExport } from '../../utils/exports/engine'
import type { ExportFormat } from '../../utils/exports/types'

const exportRoles: ExportRole[] = ['admin', 'asesor', 'supervisor', 'asistente_comercial', 'verificador']

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const role = user.role?.name as ExportRole | undefined
  if (!role || !exportRoles.includes(role)) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para exportar matrículas' })

  const query = getQuery(event)
  const format: ExportFormat = query.format === 'csv' ? 'csv' : 'xlsx'
  const document = await buildEnrollmentExport(user as { id: string; role: { name: string } }, {
    holderName: typeof query.holderName === 'string' ? query.holderName.trim() : undefined,
    holderDni: typeof query.holderDni === 'string' ? query.holderDni.trim() : undefined,
    advisorName: typeof query.advisorName === 'string' ? query.advisorName.trim() : undefined,
    status: typeof query.status === 'string' ? query.status.trim() : undefined,
    search: typeof query.search === 'string' ? query.search.trim() : undefined,
    expedientStatus: typeof query.expedientStatus === 'string' ? query.expedientStatus.trim() : undefined,
    location: typeof query.location === 'string' ? query.location.trim() : undefined
  })
  const output = renderExport(document, format)
  setHeader(event, 'Content-Type', output.contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${document.filename}_${new Date().toISOString().slice(0, 10)}.${output.extension}"`)
  return output.body
})
