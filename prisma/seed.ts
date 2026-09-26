import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import bcrypt from 'bcryptjs'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dumpPath = resolve(process.cwd(), 'old_system/matriculas310720260951.sql')

const roles = [
  { name: 'admin', permissions: { manageUsers: true, manageContracts: true } },
  { name: 'asesor', permissions: { manageContracts: true } },
  { name: 'verificador', permissions: { verifyContracts: true } },
  { name: 'user', permissions: {} }
] as const

type SqlRow = Record<string, unknown>

// Deterministic UUIDs make the migration repeatable and preserve every relation.
function legacyUuid(namespace: string, legacyId: number): string {
  const bytes = createHash('sha1').update(`${namespace}:${legacyId}`).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function parseSqlValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed.toUpperCase() === 'NULL') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/''/g, "'")
  }
  return trimmed
}

function parseInsertRows(sql: string, table: string): SqlRow[] {
  const expression = new RegExp('INSERT\\s+INTO\\s+[^\\w]*' + table + '[^\\w]*\\(([^)]*)\\)\\s+VALUES\\s*([\\s\\S]*?);', 'g')
  const rows: SqlRow[] = []
  let match: RegExpExecArray | null

  while ((match = expression.exec(sql))) {
    const columns = match[1].split(',').map((column) => column.trim().replace(/^`|`$/g, ''))
    const values = match[2]
    let row: string[] = []
    let token = ''
    let inString = false
    let escaped = false
    let depth = 0
    const flush = (): void => { if (token.trim() || row.length) row.push(token.trim()); token = '' }

    for (let index = 0; index < values.length; index += 1) {
      const character = values[index]
      const next = values[index + 1]
      if (inString) {
        token += character
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === "'" && next === "'") { token += next; index += 1 }
        else if (character === "'") inString = false
      } else if (character === "'") { inString = true; token += character }
      else if (character === '(') depth += 1
      else if (character === ')') {
        depth -= 1
        if (depth === 0) {
          flush()
          if (row.length !== columns.length) throw new Error(`Fila inválida en ${table}: esperaba ${columns.length} valores y recibió ${row.length}`)
          rows.push(Object.fromEntries(columns.map((column, i) => [column, parseSqlValue(row[i] ?? '')])))
          row = []
        }
      } else if (character === ',' && depth === 1) flush()
      else if (depth > 0) token += character
    }
  }
  return rows
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const result = String(value).replace(/\\'/g, "'").replace(/''/g, "'")
  return result === '' ? null : result
}

function requiredText(value: unknown, field: string): string {
  const result = text(value)
  if (!result) throw new Error(`El campo obligatorio ${field} está vacío en el dump`)
  return result
}

function date(value: unknown): Date | null {
  const result = text(value)
  if (!result || result.startsWith('0000-00-00')) return null
  const parsed = new Date(result.length === 10 ? `${result}T00:00:00Z` : `${result.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Fecha inválida en el dump: ${result}`)
  return parsed
}

function decimal(value: unknown): Prisma.Decimal | null {
  const result = text(value)
  return result === null ? null : new Prisma.Decimal(result)
}

function boolean(value: unknown): boolean { return Number(value || 0) !== 0 }
function asNumber(value: unknown): number {
  const result = Number(value)
  if (!Number.isInteger(result)) throw new Error(`ID legado inválido: ${String(value)}`)
  return result
}

async function main(): Promise<void> {
  const sql = await readFile(dumpPath, 'utf8')
  const legacyUsers = parseInsertRows(sql, 'usuarios')
  const legacyContracts = parseInsertRows(sql, 'contratos')
  const legacyReceipts = parseInsertRows(sql, 'recibos')
  if (!legacyUsers.length) throw new Error(`No se encontraron usuarios en ${dumpPath}`)

  for (const role of roles) await prisma.role.upsert({ where: { name: role.name }, update: { permissions: role.permissions }, create: role })
  const roleIds = new Map((await prisma.role.findMany()).map((role) => [role.name, role.id]))
  const temporaryPassword = process.env.LEGACY_DEFAULT_PASSWORD
  if (!temporaryPassword || temporaryPassword.length < 12) throw new Error('Define LEGACY_DEFAULT_PASSWORD con al menos 12 caracteres antes de ejecutar la migración.')
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12)
  const userIds = new Map<number, string>()

  for (const legacy of legacyUsers) {
    const legacyId = asNumber(legacy.id)
    const username = requiredText(legacy.usuario, `usuario(${legacyId})`)
    const roleName = requiredText(legacy.rol, `rol(${legacyId})`)
    const roleId = roleIds.get(roleName)
    if (!roleId) throw new Error(`Rol legado no soportado: ${roleName}`)
    const existing = await prisma.user.findUnique({ where: { username } })
    const id = existing?.id ?? legacyUuid('user', legacyId)
    const email = text(legacy.email) ?? `${username}@legacy.invalid`
    const name = requiredText(legacy.nombre, `nombre(${legacyId})`)
    await prisma.user.upsert({
      where: { id },
      update: { username, email, name, active: boolean(legacy.activo), roleId },
      create: { id, username, email, password: temporaryPasswordHash, name, active: boolean(legacy.activo), roleId, createdAt: date(legacy.fecha_registro) ?? new Date() }
    })
    userIds.set(legacyId, id)
  }

  const contractIds = new Map<number, string>()
  for (const legacy of legacyContracts) {
    const legacyId = asNumber(legacy.id)
    const userId = userIds.get(asNumber(legacy.usuario_id))
    if (!userId) throw new Error(`El contrato ${legacyId} referencia al usuario inexistente ${String(legacy.usuario_id)}`)
    const contractNumber = requiredText(legacy.nro_contrato, `nro_contrato(${legacyId})`)
    const existing = await prisma.contract.findUnique({ where: { contractNumber } })
    const id = existing?.id ?? legacyUuid('contract', legacyId)
    const holderBirthDate = date(legacy.titular_fecha_nacimiento)
    if (!holderBirthDate) throw new Error(`El contrato ${legacyId} no tiene fecha de nacimiento válida`)
    const data = {
      id, userId, registeredAt: date(legacy.fecha_registro) ?? new Date(),
      contractDepartment: text(legacy.contrato_dep), contractProvince: text(legacy.contrato_prov), contractDistrict: text(legacy.contrato_dist), contractNumber,
      holderName: requiredText(legacy.titular_nombre, `titular_nombre(${legacyId})`), holderBirthDate, holderDni: requiredText(legacy.titular_dni, `titular_dni(${legacyId})`), holderEmail: requiredText(legacy.titular_email, `titular_email(${legacyId})`), holderAddress: requiredText(legacy.titular_direccion, `titular_direccion(${legacyId})`), holderDepartment: text(legacy.titular_dep), holderProvince: text(legacy.titular_prov), holderDistrict: text(legacy.titular_dist), holderPhone: requiredText(legacy.titular_celular, `titular_celular(${legacyId})`),
      beneficiary1Name: text(legacy.beneficiario1_nombre), beneficiary1BirthDate: date(legacy.beneficiario1_fecha_nacimiento), beneficiary1Dni: text(legacy.beneficiario1_dni), beneficiary1Email: text(legacy.beneficiario1_email), beneficiary1Phone: text(legacy.beneficiario1_celular), beneficiary2Name: text(legacy.beneficiario2_nombre), beneficiary2BirthDate: date(legacy.beneficiario2_fecha_nacimiento), beneficiary2Dni: text(legacy.beneficiario2_dni), beneficiary2Email: text(legacy.beneficiario2_email), beneficiary2Phone: text(legacy.beneficiario2_celular),
      currentSituation: requiredText(legacy.situacion_actual, `situacion_actual(${legacyId})`), housingType: requiredText(legacy.tipo_vivienda, `tipo_vivienda(${legacyId})`), dataAuthorization: boolean(legacy.autorizacion_datos), accepted: boolean(legacy.acepto), strategy: requiredText(legacy.estrategia, `estrategia(${legacyId})`), paymentStartDate: text(legacy.fecha_inicio_pago), modality: text(legacy.modalidad), program: requiredText(legacy.programa, `programa(${legacyId})`), plan: text(legacy.plan), cashPayment: boolean(legacy.modalidad_contado), financedPayment: boolean(legacy.modalidad_financiado), programValue: decimal(legacy.valor_programa)!, initialPayment: decimal(legacy.cuota_inicial), balance: decimal(legacy.saldo), installmentCount: legacy.nro_cuotas === null ? null : asNumber(legacy.nro_cuotas), installmentValue: decimal(legacy.valor_cuota), otherPayment: text(legacy.otro_pago), notes: text(legacy.observaciones), status: text(legacy.estado), testimonials: boolean(legacy.testimonios), dataUsage: legacy.uso_datos === null ? null : boolean(legacy.uso_datos), createdAt: date(legacy.created_at) ?? new Date(), updatedAt: date(legacy.updated_at) ?? new Date(), acceptedAt: date(legacy.acepto_fecha), acceptedIp: text(legacy.acepto_ip), accessToken: text(legacy.access_token), tokenExpiresAt: date(legacy.token_expiration)
    }
    await prisma.contract.upsert({ where: { id }, update: { userId, updatedAt: data.updatedAt }, create: data })
    contractIds.set(legacyId, id)
  }

  for (const legacy of legacyReceipts) {
    const legacyId = asNumber(legacy.id)
    const contractId = contractIds.get(asNumber(legacy.contrato_id))
    const userId = userIds.get(asNumber(legacy.usuario_id))
    if (!contractId || !userId) { console.warn(`Recibo ${legacyId} omitido: contrato o usuario no encontrado`); continue }
    const id = legacyUuid('receipt', legacyId)
    await prisma.receipt.upsert({ where: { id }, update: { contractId, userId }, create: { id, contractId, userId, registeredRole: text(legacy.rol_registro), amount: decimal(legacy.cuota_inicial), concepts: text(legacy.conceptos), otherConcept: text(legacy.otros_concepto), paymentMethod: text(legacy.forma_pago), operationNumber: text(legacy.nro_operacion), bank: text(legacy.banco), transactionDate: date(legacy.fecha_transaccion), registeredAt: date(legacy.fecha_registro) ?? new Date() } })
  }
  console.log(`Migración completada: ${legacyUsers.length} usuarios, ${legacyContracts.length} contratos y ${legacyReceipts.length} recibos procesados.`)
  console.warn('Las cuentas migradas usan LEGACY_DEFAULT_PASSWORD. Obliga a cambiarla después del primer acceso.')
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
