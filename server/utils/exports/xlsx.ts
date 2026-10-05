import { deflateRawSync } from 'node:zlib'
import type { ExportDocument } from './types'

const encoder = new TextEncoder()

function escapeXml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function textValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

function columnName(index: number): string {
  let result = ''
  let current = index + 1
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

function sheetXml(document: ExportDocument): string {
  const rows = [document.columns.map((column) => column.header), ...document.rows.map((row) => document.columns.map((column) => textValue(column.value ? column.value(row) : row[column.key])))]
  const xmlRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint16(value: number): Uint8Array { return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]) }
function uint32(value: number): Uint8Array { return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]) }
function concat(parts: Uint8Array[]): Buffer { return Buffer.from(parts.reduce((result, part) => { result.push(...part); return result }, [] as number[])) }

function zip(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const source = encoder.encode(file.content)
    const compressed = deflateRawSync(source)
    const checksum = crc32(source)
    const local = concat([Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), uint16(20), uint16(0), uint16(8), uint16(0), uint16(0), uint32(checksum), uint32(compressed.length), uint32(source.length), uint16(name.length), uint16(0), name, compressed])
    localParts.push(local)
    centralParts.push(concat([Uint8Array.from([0x50, 0x4b, 0x01, 0x02]), uint16(20), uint16(20), uint16(0), uint16(8), uint16(0), uint16(0), uint32(checksum), uint32(compressed.length), uint32(source.length), uint16(name.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name]))
    offset += local.length
  }
  const local = concat(localParts)
  const central = concat(centralParts)
  const end = concat([Uint8Array.from([0x50, 0x4b, 0x05, 0x06]), uint16(0), uint16(0), uint16(files.length), uint16(files.length), uint32(central.length), uint32(local.length), uint16(0)])
  return Buffer.concat([local, central, end])
}

export function renderXlsx(document: ExportDocument): Buffer {
  const sheetName = escapeXml((document.sheetName || 'Reporte').slice(0, 31))
  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(document) }
  ])
}
