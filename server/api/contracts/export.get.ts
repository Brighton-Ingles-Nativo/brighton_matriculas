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

  const query = getQuery(event)
  const holderName = typeof query.holderName === 'string' ? query.holderName.trim() : ''
  const holderDni = typeof query.holderDni === 'string' ? query.holderDni.trim() : ''
  const advisorName = typeof query.advisorName === 'string' ? query.advisorName.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const statusFilter = status === 'revision'
    ? { accepted: false, OR: [{ status: '0' }, { status: null }] }
    : status === 'firmado'
      ? { accepted: true }
      : status === 'revisado'
        ? { status: '1' }
        : status === 'anulado'
          ? { status: '-5' }
          : {}
  const contracts = await prisma.contract.findMany({
    where: {
      ...(holderName || holderDni ? {
        customer: {
          ...(holderName ? { name: { contains: holderName, mode: 'insensitive' as const } } : {}),
          ...(holderDni ? { dni: { contains: holderDni, mode: 'insensitive' as const } } : {})
        }
      } : {}),
      ...(advisorName ? { user: { name: { contains: advisorName, mode: 'insensitive' as const } } } : {}),
      ...statusFilter
    },
    orderBy: { registeredAt: 'desc' },
    include: { user: { select: { name: true } }, customer: true, otherData: true, strategyDefinition: { select: { name: true } } }
  })

  const header = columns.map(([label]) => csv(label)).join(';')
  const rows = contracts.map((contract) => {
    const row: Record<string, unknown> = {
      ...contract,
      holderName: contract.customer.name,
      holderDni: contract.customer.dni,
      holderEmail: contract.customer.email,
      holderPhone: contract.customer.phone,
      holderAddress: contract.customer.address,
      strategy: contract.strategyNameSnapshot ?? contract.strategyDefinition?.name ?? contract.otherData?.strategy,
      notes: contract.otherData?.notes,
      advisor: contract.user.name
    }
    return columns.map(([, key]) => csv(row[key])).join(';')
  })

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="matriculas_brighton_${new Date().toISOString().slice(0, 10)}.csv"`)
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`
})
