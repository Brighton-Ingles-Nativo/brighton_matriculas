import { renderCsv } from './csv'
import { renderXlsx } from './xlsx'
import type { ExportDocument, ExportFormat } from './types'

export function renderExport(document: ExportDocument, format: ExportFormat): { body: Buffer; contentType: string; extension: string } {
  if (format === 'csv') return { body: renderCsv(document), contentType: 'text/csv; charset=utf-8', extension: 'csv' }
  return {
    body: renderXlsx(document),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx'
  }
}

