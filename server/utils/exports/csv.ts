import type { ExportDocument } from './types'

function stringify(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

function escapeCsv(value: unknown): string {
  return `"${stringify(value).replace(/[\r\n;]/g, (character) => character === ';' ? ',' : ' ').replace(/"/g, '""')}"`
}

export function renderCsv(document: ExportDocument): Buffer {
  const header = document.columns.map((column) => escapeCsv(column.header)).join(';')
  const rows = document.rows.map((row) => document.columns
    .map((column) => escapeCsv(column.value ? column.value(row) : row[column.key]))
    .join(';'))

  return Buffer.from(`\uFEFF${[header, ...rows].join('\r\n')}\r\n`, 'utf8')
}
