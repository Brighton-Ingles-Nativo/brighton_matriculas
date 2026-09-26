import { getUserBySession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

const clean = (value: unknown) => String(value ?? '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?')
const money = (value: unknown) => value === null || value === undefined ? '-' : `S/ ${String(value)}`
const pdfString = (value: string) => `(${clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`

function buildPdf(receipt: any): Buffer {
  const date = receipt.transactionDate || receipt.registeredAt
  const lines = [
    'BRIGHTON - RECIBO DE PAGO',
    `Contrato: ${receipt.contract.contractNumber}`,
    `Fecha: ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(date))}`,
    '',
    'DATOS DEL TITULAR',
    `Nombre: ${receipt.contract.holderName}`,
    `DNI: ${receipt.contract.holderDni}`,
    `Direccion: ${receipt.contract.holderAddress}`,
    `Celular: ${receipt.contract.holderPhone}`,
    '',
    'DETALLE DEL PAGO',
    `Concepto: ${receipt.concepts || '-'}`,
    `Otros: ${receipt.otherConcept || '-'}`,
    `Monto: ${money(receipt.amount)}`,
    `Forma de pago: ${receipt.paymentMethod || '-'}`,
    `Banco: ${receipt.bank || '-'}`,
    `Nro. operacion: ${receipt.operationNumber || '-'}`,
    '',
    'CONDICIONES GENERALES DE CUMPLIMIENTO',
    'El presente recibo acredita la separacion de vacante o pago indicado en el detalle.',
    'El monto sera imputado al precio del programa segun las condiciones pactadas.',
    'El contrato definitivo debera ser suscrito dentro del plazo establecido.',
    '',
    `Registrado por: ${receipt.user.name} (${receipt.registeredRole || '-'})`
  ]
  const wrapped = lines.flatMap((line) => { const value = clean(line); if (value.length <= 108) return [value]; const result: string[] = []; for (let index = 0; index < value.length; index += 108) result.push(value.slice(index, index + 108)); return result })
  const pageLines = 48; const pages = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / pageLines)) }, (_, page) => wrapped.slice(page * pageLines, (page + 1) * pageLines)); const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); const pageNumbers = pages.map((_, index) => 4 + index * 2); objects.push(`<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`); objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const [pageIndex, page] of pages.entries()) { const pageNumber = 4 + pageIndex * 2; const contentNumber = pageNumber + 1; const commands = ['BT', '/F1 10 Tf', '50 790 Td', '14 TL']; page.forEach((line, index) => { if (index) commands.push('T*'); commands.push(pdfString(line)) }); commands.push('ET'); const stream = commands.join('\n'); objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`); objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`) }
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` }); const xref = Buffer.byteLength(pdf, 'latin1'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(pdf, 'latin1')
}

export default defineEventHandler(async (event) => {
  const user = await getUserBySession(event); if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesion no valida' })
  const id = getRouterParam(event, 'id'); if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de recibo invalido' })
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { contract: true, user: { select: { id: true, name: true } } } }); if (!receipt) throw createError({ statusCode: 404, statusMessage: 'Recibo no encontrado' })
  if (user.role?.name === 'asesor' && receipt.contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a este recibo' })
  setHeader(event, 'Content-Type', 'application/pdf'); setHeader(event, 'Content-Disposition', `inline; filename="recibo-${receipt.contract.contractNumber}.pdf"`); return buildPdf(receipt)
})
