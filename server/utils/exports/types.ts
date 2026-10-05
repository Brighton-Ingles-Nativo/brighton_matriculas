export type ExportFormat = 'csv' | 'xlsx'

export interface ExportColumn<Row extends Record<string, unknown> = Record<string, unknown>> {
  header: string
  key: string
  value?: (row: Row) => unknown
}

export interface ExportDocument {
  filename: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  sheetName?: string
}

