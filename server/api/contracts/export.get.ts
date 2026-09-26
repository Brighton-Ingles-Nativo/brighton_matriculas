import { getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const columns = [
  ['Número de matrícula', 'contractNumber'], ['Fecha de registro', 'registeredAt'], ['Estado', 'status'], ['Aceptado', 'accepted'],
  ['Titular', 'holderName'], ['DNI', 'holderDni'], ['Correo', 'holderEmail'], ['Celular', 'holderPhone'], ['Dirección', 'holderAddress'],
  ['Departamento', 'contractDepartment'], ['Provincia', 'contractProvince'], ['Distrito', 'contractDistrict'], ['Programa', 'program'], ['Plan', 'plan'],
  ['Modalidad', 'modality'], ['Valor programa', 'programValue'], ['Cuota inicial', 'initialPayment'], ['Saldo', 'balance'], ['Nro. cuotas', 'installmentCount'],
  ['Valor cuota', 'installmentValue'], ['Forma de pago', 'cashPayment'], ['Financiado', 'financedPayment'], ['Estrategia', 'strategy'], ['Observaciones', 'notes'],
  ['Asesor', 'advisor']
] as const

function csv(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/[\r\n;]/g, (character) => character === ';' ? ',' : ' ').replace(/"/g, '""')}"`
}

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  if (!['admin', 'verificador'].includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para exportar matrículas' })

  const search = typeof getQuery(event).search === 'string' ? String(getQuery(event).search).trim() : ''
  const contracts = await prisma.contract.findMany({
    where: search ? { OR: [{ contractNumber: { contains: search, mode: 'insensitive' } }, { holderName: { contains: search, mode: 'insensitive' } }, { holderDni: { contains: search, mode: 'insensitive' } }] } : undefined,
    orderBy: { registeredAt: 'desc' },
    include: { user: { select: { name: true } } }
  })

  const header = columns.map(([label]) => csv(label)).join(';')
  const rows = contracts.map((contract) => {
    const row: Record<string, unknown> = { ...contract, advisor: contract.user.name }
    return columns.map(([, key]) => csv(row[key])).join(';')
  })

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="matriculas_brighton_${new Date().toISOString().slice(0, 10)}.csv"`)
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`
})
