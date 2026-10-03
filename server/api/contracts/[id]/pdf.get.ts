import { getQuery } from 'h3'
import { getUserBySession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

type PdfContract = {
  contractNumber: string
  registeredAt: Date
  contractDepartment: string | null
  contractProvince: string | null
  contractDistrict: string | null
  customer: { name: string; birthDate: Date; dni: string; email: string; address: string; department: string | null; province: string | null; district: string | null; phone: string }
  students: Array<{ student: { name: string; birthDate: Date | null; dni: string | null; email: string | null; phone: string | null } }>
  otherData: { currentSituation: string; housingType: string; dataAuthorization: boolean; strategy: string; notes: string | null; testimonials: boolean; dataUsage: boolean | null } | null
  signedAt: Date | null
  paymentStartDate: string | null
  modality: string | null
  program: string
  plan: string | null
  cashPayment: boolean
  financedPayment: boolean
  programValue: { toString(): string }
  initialPayment: { toString(): string } | null
  balance: { toString(): string } | null
  installmentCount: number | null
  installmentValue: { toString(): string } | null
  otherPayment: string | null
  status: string | null
  signedIp: string | null
  user: { id: string; name: string; username: string }
  receipts: Array<{
    amount: { toString(): string } | null
    concepts: string | null
    otherConcept: string | null
    paymentMethod: string | null
    operationNumber: string | null
    bank: string | null
    transactionDate: Date | null
    registeredAt: Date
  }>
}

const clean = (value: unknown): string => String(value ?? '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?')
const date = (value: Date | null | undefined): string => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(value) : '-'
const yesNo = (value: boolean | null): string => value === null ? '-' : value ? 'Si' : 'No'
const money = (value: { toString(): string } | null): string => value ? `S/ ${value.toString()}` : '-'

function pdfString(value: string): string {
  return `(${clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`
}

function buildPdf(contract: PdfContract): Buffer {
  const lines = [
    'BRIGHTON - DETALLE DE CONTRATO',
    `Contrato: ${contract.contractNumber}`,
    `Registrado: ${date(contract.registeredAt)}    Asesor: ${contract.user.name}`,
    '',
    'TITULAR',
    `Nombre: ${contract.customer.name}`,
    `DNI: ${contract.customer.dni}    Nacimiento: ${date(contract.customer.birthDate)}`,
    `Correo: ${contract.customer.email}`,
    `Celular: ${contract.customer.phone}`,
    `Direccion: ${contract.customer.address}`,
    `Ubicacion: ${contract.customer.district || '-'}, ${contract.customer.province || '-'}, ${contract.customer.department || '-'}`,
    '',
    'ALUMNOS / BENEFICIARIOS',
    ...(contract.students.length ? contract.students.map(({ student }, index) => `${index + 1}. ${student.name} | DNI: ${student.dni || '-'} | Nacimiento: ${date(student.birthDate)} | Correo: ${student.email || '-'} | Celular: ${student.phone || '-'}`) : ['Sin alumnos registrados.']),
    '',
    'PROGRAMA Y PAGOS',
    `Programa: ${contract.program}    Plan: ${contract.plan || '-'}`,
    `Valor: ${money(contract.programValue)}    Cuota inicial: ${money(contract.initialPayment)}    Saldo: ${money(contract.balance)}`,
    `Modalidad: ${contract.modality || '-'}    Inicio de pago: ${contract.paymentStartDate || '-'}`,
    `Cuotas: ${contract.installmentCount ?? '-'}    Valor cuota: ${money(contract.installmentValue)}`,
    `Contado: ${yesNo(contract.cashPayment)}    Financiado: ${yesNo(contract.financedPayment)}`,
    '',
    'DATOS DEL REGISTRO',
    `Situacion: ${contract.otherData?.currentSituation || '-'}    Vivienda: ${contract.otherData?.housingType || '-'}`,
    `Estrategia: ${contract.otherData?.strategy || '-'}    Estado: ${contract.status || '-'}`,
    `Autorizacion de datos: ${yesNo(contract.otherData?.dataAuthorization ?? null)}    Uso de datos: ${yesNo(contract.otherData?.dataUsage ?? null)}`,
    `Firmado: ${yesNo(Boolean(contract.signedAt))}    Testimonios: ${yesNo(contract.otherData?.testimonials ?? null)}`,
    `Fecha firma: ${date(contract.signedAt)}    IP: ${contract.signedIp || '-'}`,
    '',
    'RECIBOS',
    ...(contract.receipts.length ? contract.receipts.flatMap((receipt, index) => [
      `${index + 1}. ${receipt.concepts || 'Pago'} - ${money(receipt.amount)} - ${receipt.paymentMethod || '-'} - ${date(receipt.transactionDate || receipt.registeredAt)}`,
      `   Operacion: ${receipt.operationNumber || '-'}    Banco: ${receipt.bank || '-'}    Otros: ${receipt.otherConcept || '-'}`
    ]) : ['No hay recibos registrados.']),
    '',
    'OBSERVACIONES',
    ...(contract.otherData?.notes ? contract.otherData.notes.split(/\r?\n/) : ['-'])
  ]

  const wrapped = lines.flatMap((line) => {
    const value = clean(line)
    if (value.length <= 108) return [value]
    const result: string[] = []
    for (let index = 0; index < value.length; index += 108) result.push(value.slice(index, index + 108))
    return result
  })
  const pageLines = 48
  const pages = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / pageLines)) }, (_, page) => wrapped.slice(page * pageLines, (page + 1) * pageLines))
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2)
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const [pageIndex, page] of pages.entries()) {
    const pageNumber = 4 + pageIndex * 2
    const contentNumber = pageNumber + 1
    const commands = ['BT', '/F1 10 Tf', '50 790 Td', '14 TL']
    page.forEach((line, index) => { if (index) commands.push('T*'); commands.push(pdfString(line)) })
    commands.push('ET')
    const stream = commands.join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`)
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  }
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  const tokenQuery = getQuery(event).token
  const publicToken = typeof tokenQuery === 'string' ? tokenQuery : null
  if (!user && (publicToken === null || !/^[0-9a-f]{64}$/i.test(publicToken))) throw createError({ statusCode: 401, statusMessage: 'Sesion no valida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de contrato invalido' })
  const contract = await prisma.contract.findFirst({ where: { id, ...(user ? {} : { accessToken: publicToken!, tokenExpiresAt: { gt: new Date() } }) }, include: { user: { select: { id: true, name: true, username: true } }, customer: true, students: { include: { student: true }, orderBy: { id: 'asc' } }, otherData: true, receipts: { orderBy: { registeredAt: 'desc' }, select: { amount: true, concepts: true, otherConcept: true, paymentMethod: true, operationNumber: true, bank: true, transactionDate: true, registeredAt: true } } } }) as PdfContract | null
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Contrato no encontrado' })
  if (user && user.role?.name === 'asesor' && contract.user.id !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este contrato' })
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="contrato-${contract.contractNumber}.pdf"`)
  return buildPdf(contract)
})
