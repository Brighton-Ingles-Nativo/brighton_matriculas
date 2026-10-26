import { load } from 'cheerio'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getUserBySession } from '../../../utils/auth'
import { assertContractAccess } from '../../../utils/contract-access'
import { prisma } from '../../../utils/prisma'
import { TERMS_HTML } from '../../../utils/terms'
import { displayBirthDate } from '../../../../app/utils/birth-date'

type PdfContract = {
  contractNumber: string
  registeredAt: Date
  contractDepartment: string | null
  contractProvince: string | null
  contractDistrict: string | null
  customer: { name: string; birthDate: string; dni: string; email: string; address: string; department: string | null; province: string | null; district: string | null; phone: string }
  students: Array<{ student: { name: string; birthDate: string; dni: string | null; email: string | null; phone: string | null } }>
  otherData: { currentSituation: string; housingType: string; dataAuthorization: boolean; strategy: string; notes: string | null; testimonials: boolean; dataUsage: boolean | null } | null
  signedAccept: boolean
  signedAt: Date | null
  signedIp: string | null
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
  user: { name: string }
}

const winAnsiMap: Record<string, string> = {
  '€': '\x80', '‚': '\x82', 'ƒ': '\x83', '„': '\x84', '…': '\x85', '†': '\x86', '‡': '\x87',
  'ˆ': '\x88', '‰': '\x89', 'Š': '\x8A', '‹': '\x8B', 'Œ': '\x8C', 'Ž': '\x8E',
  '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '–': '\x96', '—': '\x97',
  '™': '\x99', 'š': '\x9A', '›': '\x9B', 'œ': '\x9C', 'ž': '\x9E', 'Ÿ': '\x9F',
}

const pdfText = (value: unknown) => String(value ?? '—')
  .replace(/[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—™š›œžŸ]/g, character => winAnsiMap[character] || character)
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const dateTime = (value: Date | null | undefined) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(value) : '—'
const money = (value: { toString(): string } | null) => value ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value.toString())) : '—'
const location = (district: string | null, province: string | null, department: string | null) => [district, province, department].filter(Boolean).join(', ') || '—'

function wrap(value: string, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['—']
}

function buildPdf(contract: PdfContract, signatureImage: Buffer): Buffer {
  const pageWidth = 595
  const pageHeight = 842
  const margin = 42
  const pages: string[][] = []
  let commands: string[] = []
  let y = 0
  let pageNumber = 0

  const text = (value: string, x: number, baseline: number, size = 9, bold = false, color = '0.13 0.16 0.20') => {
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${pdfText(value)}) Tj ET`)
  }
  const rect = (x: number, bottom: number, width: number, height: number, color: string) => {
    commands.push(`${color} rg ${x} ${bottom} ${width} ${height} re f`)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, color = '0.84 0.88 0.93') => {
    commands.push(`${color} RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`)
  }
  const strokedRect = (x: number, bottom: number, width: number, height: number, color: string) => {
    commands.push(`${color} RG 1.2 w ${x} ${bottom} ${width} ${height} re S`)
  }
  const footer = () => {
    line(margin, 35, pageWidth - margin, 35)
    text(`Registrado por: ${contract.user.name}`, margin, 22, 7, false, '0.38 0.42 0.47')
    text(`Estado: ${contract.status || '—'}   |   Página ${pageNumber}`, pageWidth - margin - 145, 22, 7, false, '0.38 0.42 0.47')
  }
  const beginPage = () => {
    if (commands.length) {
      footer()
      pages.push(commands)
    }
    commands = []
    pageNumber += 1
    rect(0, pageHeight - 58, pageWidth, 58, '0.00 0.29 0.68')
    text('BRIGHTON INGLES NATIVO S.A.C.', margin, pageHeight - 27, 14, true, '1 1 1')
    text(`CONTRATO ${contract.contractNumber}`, margin, pageHeight - 45, 9, false, '1 1 1')
    y = pageHeight - 78
  }
  const ensure = (height: number) => { if (y - height < 44) beginPage() }
  const section = (title: string) => {
    ensure(30)
    rect(margin, y - 18, pageWidth - margin * 2, 22, '0.91 0.93 0.95')
    rect(margin, y - 18, 4, 22, '0.00 0.29 0.68')
    text(title.toLocaleUpperCase('es-PE'), margin + 12, y - 11, 9, true, '0.00 0.29 0.68')
    y -= 31
  }
  const fields = (entries: Array<[string, unknown]>) => {
    const gap = 18
    const columnWidth = (pageWidth - margin * 2 - gap) / 2
    for (let index = 0; index < entries.length; index += 2) {
      const row = entries.slice(index, index + 2)
      const values = row.map(([label, value], column) => {
        const x = margin + column * (columnWidth + gap)
        const lines = wrap(String(value ?? '—'), 48)
        return { label, lines, x }
      })
      const rowHeight = Math.max(...values.map(value => 23 + Math.max(1, value.lines.length) * 11))
      ensure(rowHeight + 4)
      for (const entry of values) {
        text(entry.label.toLocaleUpperCase('es-PE'), entry.x, y, 6.5, true, '0.38 0.42 0.47')
        entry.lines.forEach((value, lineIndex) => text(value, entry.x, y - 11 - lineIndex * 11, 8.5, lineIndex === 0))
        line(entry.x, y - rowHeight + 3, entry.x + columnWidth, y - rowHeight + 3)
      }
      y -= rowHeight + 6
    }
  }
  const paragraph = (value: string, options: { bold?: boolean; indent?: number } = {}) => {
    const indent = options.indent || 0
    const lines = wrap(value, Math.floor((pageWidth - margin * 2 - indent) / 5.2))
    ensure(lines.length * 12 + 7)
    for (const valueLine of lines) {
      text(valueLine, margin + indent, y, 8.5, Boolean(options.bold))
      y -= 12
    }
    y -= 5
  }

  beginPage()
  fields([
    ['Nro. de contrato', contract.contractNumber],
    ['Fecha de registro', dateTime(contract.registeredAt)],
    ['Lugar de suscripción', location(contract.contractDistrict, contract.contractProvince, contract.contractDepartment)],
  ])
  section('Datos del titular')
  fields([
    ['Nombre completo', contract.customer.name], ['DNI / CE', contract.customer.dni],
    ['Fecha de nacimiento', contract.customer.birthDate], ['Estrategia', contract.otherData?.strategy],
    ['Situación laboral', contract.otherData?.currentSituation], ['Tipo de vivienda', contract.otherData?.housingType],
    ['Correo', contract.customer.email], ['Celular', contract.customer.phone],
    ['Dirección', contract.customer.address], ['Residencia', location(contract.customer.district, contract.customer.province, contract.customer.department)],
  ])
  for (const [index, { student }] of contract.students.entries()) {
    section(`Beneficiario ${index + 1}`)
    fields([
      ['Nombre completo', student.name], ['Fecha de nacimiento', student.birthDate],
      ['DNI / CE', student.dni], ['Correo', student.email], ['Celular', student.phone],
    ])
  }
  section('Información del programa')
  fields([
    ['Modalidad', contract.modality], ['Programa', contract.program], ['Plan', contract.plan],
    ['Modalidad de pago', contract.cashPayment ? 'CONTADO' : contract.financedPayment ? 'FINANCIADO' : '—'],
    ['Fecha de inicio de pago', contract.paymentStartDate],
  ])
  section('Detalles económicos')
  fields([
    ['Valor del programa', money(contract.programValue)],
    ...(contract.cashPayment
      ? [['Descuento', contract.otherPayment ? money({ toString: () => contract.otherPayment! }) : '—'] as [string, unknown], ['Cuota inicial (pago total)', money(contract.initialPayment)] as [string, unknown]]
      : [['Cuota inicial', money(contract.initialPayment)] as [string, unknown], ['Saldo', money(contract.balance)] as [string, unknown], ['Número de cuotas', contract.installmentCount] as [string, unknown], ['Valor de cuota', money(contract.installmentValue)] as [string, unknown], ['Descuento', contract.otherPayment ? money({ toString: () => contract.otherPayment! }) : '—'] as [string, unknown]]),
  ])
  if (contract.otherData?.notes) fields([['Observaciones', contract.otherData.notes]])
  section('Autorizaciones')
  fields([
    ['Uso de datos personales', contract.otherData?.dataAuthorization ? 'AUTORIZADO' : 'NO AUTORIZADO'],
    ['Testimonios grabados', contract.otherData?.testimonials ? 'AUTORIZADO' : 'NO AUTORIZADO'],
    ['Uso de imagen y datos en campañas', contract.otherData?.dataUsage === null || contract.otherData?.dataUsage === undefined ? '—' : contract.otherData.dataUsage ? 'AUTORIZADO' : 'NO AUTORIZADO'],
  ])

  const $ = load(TERMS_HTML)
  section('Términos y condiciones del servicio')
  const title = $('h5').first().text().replace(/\s+/g, ' ').trim()
  if (title) paragraph(title.toLocaleUpperCase('es-PE'), { bold: true })
  $('p, li').each((_, element) => {
    const content = $(element).text().replace(/\s+/g, ' ').trim()
    if (content) paragraph(content, { bold: /^Cláusula/i.test(content), indent: element.tagName === 'li' ? 12 : 0 })
  })

  const boxHeight = 126
  ensure(boxHeight + 8)
  const boxX = margin
  const boxWidth = pageWidth - margin * 2
  const boxBottom = y - boxHeight + 14
  rect(boxX + 5, boxBottom - 6, boxWidth, boxHeight, '0.95 0.95 0.95')
  rect(boxX, boxBottom, boxWidth, boxHeight, '1 1 1')
  strokedRect(boxX, boxBottom, boxWidth, boxHeight, '0.61 0.83 0.74')
  const badgeX = boxX + 30
  const badgeY = boxBottom + 82
  const badgeRadius = 14
  const curve = badgeRadius * 0.5523
  commands.push(`0.02 0.31 0.23 rg ${badgeX + badgeRadius} ${badgeY} m ${badgeX + badgeRadius} ${badgeY + curve} ${badgeX + curve} ${badgeY + badgeRadius} ${badgeX} ${badgeY + badgeRadius} c ${badgeX - curve} ${badgeY + badgeRadius} ${badgeX - badgeRadius} ${badgeY + curve} ${badgeX - badgeRadius} ${badgeY} c ${badgeX - badgeRadius} ${badgeY - curve} ${badgeX - curve} ${badgeY - badgeRadius} ${badgeX} ${badgeY - badgeRadius} c ${badgeX + curve} ${badgeY - badgeRadius} ${badgeX + badgeRadius} ${badgeY - curve} ${badgeX + badgeRadius} ${badgeY} c f`)
  commands.push(`1 1 1 RG 2 w ${boxX + 23} ${boxBottom + 81} m ${boxX + 28} ${boxBottom + 76} l ${boxX + 37} ${boxBottom + 87} l S`)
  const signed = contract.signedAccept || Boolean(contract.signedAt)
  text(signed ? 'Contrato Aceptado Digitalmente' : 'Firma pendiente de aceptación', boxX + 54, boxBottom + 91, signed ? 11 : 10, true, '0.07 0.23 0.18')
  text(`${signed ? 'Este documento fue validado el' : 'Documento registrado el'} ${dateTime(contract.signedAt || contract.registeredAt)}.`, boxX + 54, boxBottom + 69, 8)
  text(`Registro de Seguridad (IP): ${contract.signedIp || '—'}`, boxX + 54, boxBottom + 50, 7.5, false, '0.39 0.45 0.54')
  // Keep the management signature at the right, matching the public and print layouts.
  commands.push(`q 150 0 0 97 ${boxX + boxWidth - 170} ${boxBottom + 14} cm /Im1 Do Q`)
  y = boxBottom - 18
  footer()
  pages.push(commands)

  const objects: Buffer[] = []
  const pushObject = (content: string | Buffer) => objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1'))
  pushObject('<< /Type /Catalog /Pages 2 0 R >>')
  pushObject(`<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  pushObject(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width 397 /Height 258 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${signatureImage.length} >>\nstream\n`, 'latin1'),
    signatureImage,
    Buffer.from('\nendstream', 'latin1'),
  ]))
  pages.forEach((page, index) => {
    const pageNumber = 6 + index * 2
    const contentNumber = pageNumber + 1
    const stream = Buffer.from(page.join('\n'), 'latin1')
    pushObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents ${contentNumber} 0 R >>`)
    pushObject(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream', 'latin1')]))
  })
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const offsets = [0]
  let length = chunks[0].length
  objects.forEach((object, index) => {
    offsets.push(length)
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')])
    chunks.push(wrapped)
    length += wrapped.length
  })
  const xrefOffset = length
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(xref, 'latin1'))
  return Buffer.concat(chunks)
}

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sesión no válida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, message: 'ID de contrato inválido' })
  const contractRecord = await prisma.contract.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      customer: true,
      students: { include: { student: true }, orderBy: { id: 'asc' } },
      otherData: true,
    },
  })
  if (!contractRecord) throw createError({ statusCode: 404, message: 'Contrato no encontrado' })
  await assertContractAccess(user, id)

  const [customerBirthDateRows, studentBirthDateRows] = await Promise.all([
    prisma.$queryRaw<Array<{ birthDate: string }>>`
      SELECT TO_CHAR(customer.titular_fecha_nacimiento, 'YYYY-MM-DD') AS "birthDate"
      FROM contratos AS enrollment
      JOIN clientes AS customer ON customer.id = enrollment.cliente_id
      WHERE enrollment.id = ${id}::uuid
    `,
    prisma.$queryRaw<Array<{ studentId: string; birthDate: string | null }>>`
      SELECT enrollment_student.alumno_id AS "studentId",
             TO_CHAR(student.fecha_nacimiento, 'YYYY-MM-DD') AS "birthDate"
      FROM contratos_alumnos AS enrollment_student
      JOIN alumnos AS student ON student.id = enrollment_student.alumno_id
      WHERE enrollment_student.contrato_id = ${id}::uuid
      ORDER BY enrollment_student.id ASC
    `,
  ])
  const studentBirthDates = new Map<string, string>()
  for (const { studentId, birthDate } of studentBirthDateRows) {
    studentBirthDates.set(studentId, displayBirthDate(birthDate))
  }
  const contract: PdfContract = {
    ...contractRecord,
    customer: {
      ...contractRecord.customer,
      birthDate: displayBirthDate(customerBirthDateRows[0]?.birthDate),
    },
    students: contractRecord.students.map(({ student }) => ({
      student: {
        ...student,
        birthDate: studentBirthDates.get(student.id) ?? '—',
      },
    })),
  }

  const publicDir = process.env.NODE_ENV === 'production' ? '.output/public' : 'public'
  const signatureImage = await readFile(resolve(process.cwd(), publicDir, 'assets/images/firma_gerencia-brighton.jpg'))
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="Contrato-${contract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return buildPdf(contract, signatureImage)
})
