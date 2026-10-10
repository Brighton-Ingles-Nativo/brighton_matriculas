import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import bcrypt from 'bcryptjs'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dumpPath = resolve(process.cwd(), './backup_database.sql')

type SqlRow = Record<string, unknown>

// Deterministic UUIDs make the migration repeatable and preserve every relation.
function stableUuid(namespace: string, key: string): string {
  const bytes = createHash('sha1').update(`${namespace}:${key}`).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function identityKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeStrategyName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function strategyKey(value: string): string {
  return normalizeStrategyName(value).toLocaleUpperCase('es-PE')
}

function strategyCode(name: string, usedCodes: Set<string>): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ESTRATEGIA'

  let suffix = ''
  let attempt = 1
  let code = base.slice(0, 50)
  while (usedCodes.has(code)) {
    attempt += 1
    suffix = `_${attempt}`
    code = `${base.slice(0, 50 - suffix.length)}${suffix}`
  }
  usedCodes.add(code)
  return code
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

function findStatementEnd(sql: string, start: number): number {
  let inString = false
  let escaped = false
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index]
    const next = sql[index + 1]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === "'" && next === "'") index += 1
      else if (character === "'") inString = false
    } else if (character === "'") inString = true
    else if (character === ';') return index
  }
  return -1
}

function parseInsertRows(sql: string, table: string): SqlRow[] {
  const expression = new RegExp('INSERT\\s+INTO\\s+[^\\w]*' + table + '[^\\w]*\\(([^)]*)\\)\\s+VALUES\\s*', 'g')
  const rows: SqlRow[] = []
  let match: RegExpExecArray | null

  while ((match = expression.exec(sql))) {
    const columns = match[1].split(',').map((column) => column.trim().replace(/^`|`$/g, ''))
    const statementEnd = findStatementEnd(sql, expression.lastIndex)
    if (statementEnd < 0) throw new Error(`La sentencia INSERT de ${table} está incompleta`)
    const values = sql.slice(expression.lastIndex, statementEnd)
    expression.lastIndex = statementEnd + 1
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
  const result = String(value)
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

function boolean(value: unknown): boolean { return value === true || value === 't' || value === 'true' || value === 1 || value === '1' }

function contractStatus(status: unknown, accepted: unknown): 'REVISION' | 'FIRMADO' | 'ANULADO' {
  if (text(status) === '-5') return 'ANULADO'
  if (boolean(accepted)) return 'FIRMADO'
  return 'REVISION'
}

function json(value: unknown): Prisma.InputJsonValue {
  if (typeof value !== 'string') return (value ?? {}) as Prisma.InputJsonValue
  try { return JSON.parse(value) as Prisma.InputJsonValue }
  catch { throw new Error('JSON inválido en permisos de rol del dump.') }
}

function integer(value: unknown, field: string): number | null {
  const raw = text(value)
  if (raw === null) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) throw new Error(`El campo ${field} no es un entero válido en el dump.`)
  return parsed
}

async function main(): Promise<void> {
  const sql = await readFile(dumpPath, 'utf8')
  // The backup is the legacy MySQL source. Its tables are deliberately not
  // treated as the target schema: this function maps them into the current
  // normalized PostgreSQL models below.
  const sourceUsers = parseInsertRows(sql, 'usuarios')
  const sourceContracts = parseInsertRows(sql, 'contratos')
  const sourceReceipts = parseInsertRows(sql, 'recibos')
  if (!sourceUsers.length || !sourceContracts.length) throw new Error(`El dump no contiene usuarios y matrículas: ${dumpPath}`)

  // Check legacy foreign keys before touching the target database.
  const sourceUserIds = new Set(sourceUsers.map((row) => requiredText(row.id, 'usuarios.id')))
  const sourceContractIds = new Set(sourceContracts.map((row) => requiredText(row.id, 'contratos.id')))
  const invalidContractUsers = sourceContracts.filter((row) => !sourceUserIds.has(requiredText(row.usuario_id, `usuario_id del contrato ${String(row.id)}`)))
  const invalidReceiptContracts = sourceReceipts.filter((row) => !sourceContractIds.has(requiredText(row.contrato_id, `contrato_id del recibo ${String(row.id)}`)))
  const invalidReceiptUsers = sourceReceipts.filter((row) => !sourceUserIds.has(requiredText(row.usuario_id, `usuario_id del recibo ${String(row.id)}`)))
  if (invalidContractUsers.length || invalidReceiptContracts.length || invalidReceiptUsers.length) {
    throw new Error([
      'El dump contiene relaciones incompletas y no se importará parcialmente.',
      invalidContractUsers.length ? `Matrículas sin asesor: ${invalidContractUsers.map((row) => String(row.id)).join(', ')}` : '',
      invalidReceiptContracts.length ? `Recibos sin matrícula: ${invalidReceiptContracts.map((row) => String(row.id)).join(', ')}` : '',
      invalidReceiptUsers.length ? `Recibos sin registrador: ${invalidReceiptUsers.map((row) => String(row.id)).join(', ')}` : ''
    ].filter(Boolean).join('\n'))
  }

  // These are target roles, not legacy roles. The legacy `rol` value is only
  // used as a mapping key; permissions and target role definitions remain
  // owned by the new system/migrations.
  const legacyRoleMap: Record<string, string> = {
    admin: 'admin',
    asesor: 'asesor',
    verificador: 'verificador'
  }
  const targetRoleDefinitions = [
    { name: 'admin', permissions: { manageUsers: true, manageContracts: true } },
    { name: 'asesor', permissions: { manageContracts: true } },
    { name: 'verificador', permissions: { verifyContracts: true } }
  ] as const
  for (const role of targetRoleDefinitions) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role })
  }
  const roleIds = new Map((await prisma.role.findMany({ where: { name: { in: Object.values(legacyRoleMap) } } })).map((role) => [role.name, role.id]))
  const temporaryPassword = process.env.LEGACY_DEFAULT_PASSWORD
  if (!temporaryPassword || temporaryPassword.length < 12) throw new Error('Define LEGACY_DEFAULT_PASSWORD con al menos 12 caracteres antes de ejecutar la migración.')
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12)

  const userIds = new Map<string, string>()
  for (const source of sourceUsers) {
    const sourceId = requiredText(source.id, 'usuarios.id')
    const legacyRole = requiredText(source.rol, `rol del usuario ${sourceId}`).trim().toLowerCase()
    const targetRole = legacyRoleMap[legacyRole]
    const roleId = targetRole ? roleIds.get(targetRole) : undefined
    if (!roleId) throw new Error(`Rol legado no soportado: ${legacyRole}`)
    const username = requiredText(source.usuario, `usuario(${sourceId})`)
    const existing = await prisma.user.findUnique({ where: { username } })
    const id = existing?.id ?? stableUuid('user', sourceId)
    const userData = {
      username,
      email: text(source.email) ?? `${username}@legacy.invalid`,
      name: requiredText(source.nombre, `nombre de ${username}`),
      active: boolean(source.activo),
      roleId,
      createdAt: date(source.fecha_registro) ?? new Date()
    }
    await prisma.user.upsert({ where: { id }, update: userData, create: { id, ...userData, password: temporaryPasswordHash } })
    userIds.set(sourceId, id)
  }

  // El CRM aún no cuenta con un catálogo de estrategias definido. Se genera
  // un catálogo inicial a partir de los valores realmente usados en las
  // matrículas históricas, con códigos estables para facilitar su gestión.
  const strategyNames = [...new Set(sourceContracts
    .map((source) => normalizeStrategyName(requiredText(source.estrategia, `estrategia(${String(source.id)})`)))
  )].sort((left, right) => left.localeCompare(right, 'es-PE'))
  const existingStrategies = await prisma.strategy.findMany({ select: { id: true, name: true, code: true } })
  const existingStrategiesByName = new Map(existingStrategies.map((strategy) => [strategyKey(strategy.name), strategy]))
  const usedStrategyCodes = new Set(existingStrategies.flatMap((strategy) => strategy.code ? [strategy.code] : []))
  const strategyIds = new Map<string, string>()

  for (const [displayOrder, name] of strategyNames.entries()) {
    const existing = existingStrategiesByName.get(strategyKey(name))
    const code = existing?.code ?? strategyCode(name, usedStrategyCodes)
    const strategy = await prisma.strategy.upsert({
      where: { name },
      update: { code, displayOrder },
      create: {
        id: stableUuid('strategy', strategyKey(name)),
        code,
        name,
        active: true,
        displayOrder
      }
    })
    strategyIds.set(strategyKey(name), strategy.id)
  }

  const contractIds = new Map<string, string>()
  const customerIds = new Set<string>()
  const historicalSiteMembers = new Map<string, { name: string; userIds: Set<string> }>()
  let studentLinks = 0
  for (const source of sourceContracts) {
    const sourceId = requiredText(source.id, 'contratos.id')
    const userId = userIds.get(requiredText(source.usuario_id, `usuario_id de ${sourceId}`))
    if (!userId) throw new Error(`La matrícula ${sourceId} referencia a un asesor inexistente.`)
    const contractNumber = requiredText(source.nro_contrato, `nro_contrato(${sourceId})`)
    const strategyName = normalizeStrategyName(requiredText(source.estrategia, `estrategia(${sourceId})`))
    const strategyId = strategyIds.get(strategyKey(strategyName))
    if (!strategyId) throw new Error(`No se pudo resolver la estrategia histórica de la matrícula ${sourceId}.`)
    const historicalSiteName = text(source.contrato_dist)?.trim() || null
    if (historicalSiteName) {
      const siteKey = identityKey(historicalSiteName)
      const site = historicalSiteMembers.get(siteKey) ?? { name: historicalSiteName, userIds: new Set<string>() }
      site.userIds.add(userId)
      historicalSiteMembers.set(siteKey, site)
    }
    const holderBirthDate = date(source.titular_fecha_nacimiento)
    if (!holderBirthDate) throw new Error(`La matrícula ${sourceId} no tiene fecha de nacimiento válida.`)

    const customerData = {
      userId,
      name: requiredText(source.titular_nombre, `titular_nombre(${sourceId})`),
      birthDate: holderBirthDate,
      dni: requiredText(source.titular_dni, `titular_dni(${sourceId})`),
      email: requiredText(source.titular_email, `titular_email(${sourceId})`),
      address: requiredText(source.titular_direccion, `titular_direccion(${sourceId})`),
      department: text(source.titular_dep),
      province: text(source.titular_prov),
      district: text(source.titular_dist),
      phone: requiredText(source.titular_celular, `titular_celular(${sourceId})`)
    }
    // The source has no customer history table. Keep each advisor's exact
    // recorded profile snapshot so later edits do not overwrite older records.
    const customerId = stableUuid('customer', JSON.stringify([
      userId, identityKey(customerData.dni), customerData.name, customerData.birthDate.toISOString(),
      customerData.email, customerData.address, customerData.department, customerData.province,
      customerData.district, customerData.phone
    ]))
    await prisma.customer.upsert({ where: { id: customerId }, update: customerData, create: { id: customerId, ...customerData } })
    customerIds.add(customerId)

    const existingContract = await prisma.contract.findUnique({ where: { contractNumber } })
    const id = existingContract?.id ?? stableUuid('contract', sourceId)
    const contractData = {
      userId,
      customerId,
      registeredAt: date(source.fecha_registro) ?? new Date(),
      contractDepartment: text(source.contrato_dep),
      contractProvince: text(source.contrato_prov),
      contractDistrict: text(source.contrato_dist),
      contractNumber,
      strategyId,
      strategyNameSnapshot: strategyName,
      paymentStartDate: text(source.fecha_inicio_pago),
      modality: text(source.modalidad),
      program: requiredText(source.programa, `programa(${sourceId})`),
      plan: text(source.plan),
      cashPayment: boolean(source.modalidad_contado),
      financedPayment: boolean(source.modalidad_financiado),
      programValue: decimal(source.valor_programa)!,
      initialPayment: decimal(source.cuota_inicial),
      balance: decimal(source.saldo),
      installmentCount: integer(source.nro_cuotas, `nro_cuotas(${sourceId})`),
      installmentValue: decimal(source.valor_cuota),
      otherPayment: text(source.otro_pago),
      status: contractStatus(source.estado, source.acepto),
      createdAt: date(source.created_at) ?? new Date(),
      updatedAt: date(source.updated_at) ?? new Date(),
      signedAt: date(source.acepto_fecha),
      signedIp: text(source.acepto_ip),
      accessToken: text(source.access_token),
      tokenExpiresAt: date(source.token_expiration)
    }
    await prisma.contract.upsert({ where: { id }, update: contractData, create: { id, ...contractData } })
    contractIds.set(sourceId, id)

    const otherData = {
      currentSituation: requiredText(source.situacion_actual, `situacion_actual(${sourceId})`),
      housingType: requiredText(source.tipo_vivienda, `tipo_vivienda(${sourceId})`),
      dataAuthorization: boolean(source.autorizacion_datos),
      strategy: strategyName,
      notes: text(source.observaciones),
      testimonials: boolean(source.testimonios),
      dataUsage: source.uso_datos === null ? null : boolean(source.uso_datos)
    }
    await prisma.contractOtherData.upsert({ where: { contractId: id }, update: otherData, create: { contractId: id, ...otherData } })

    for (const slot of [1, 2] as const) {
      const studentData = {
        name: text(source[`beneficiario${slot}_nombre`]),
        birthDate: date(source[`beneficiario${slot}_fecha_nacimiento`]),
        dni: text(source[`beneficiario${slot}_dni`]),
        email: text(source[`beneficiario${slot}_email`]),
        phone: text(source[`beneficiario${slot}_celular`])
      }
      if (!studentData.name) {
        if (studentData.birthDate || studentData.dni || studentData.email || studentData.phone) {
          // The legacy form allowed partial beneficiary fields. There is no
          // valid normalized student without a name, so keep the contract
          // importable and report the orphaned fields instead of aborting the
          // complete migration.
          console.warn(`Beneficiario ${slot} de la matrícula ${sourceId} omitido: tiene datos, pero no nombre.`)
        }
        continue
      }

      const studentId = stableUuid('student', JSON.stringify([
        customerId,
        studentData.dni ? identityKey(studentData.dni) : `${id}:slot-${slot}`,
        studentData.name,
        studentData.birthDate?.toISOString() ?? null,
        studentData.dni,
        studentData.email,
        studentData.phone
      ]))
      await prisma.student.upsert({ where: { id: studentId }, update: { customerId, ...studentData }, create: { id: studentId, customerId, ...studentData } })

      const enrollmentId = stableUuid('contract-student', `${id}:${studentId}`)
      await prisma.contractStudent.upsert({
        where: { contractId_studentId: { contractId: id, studentId } },
        update: {},
        create: { id: enrollmentId, contractId: id, studentId }
      })
      studentLinks += 1
    }
  }

  // El dump legado no tiene tablas de sedes/equipos. `contrato_dist` contiene
  // los nombres históricos de sede; se preservan como sedes y se crea un
  // equipo inicial por sede para que la asignación de asesores sea operativa.
  let teamMemberships = 0
  for (const { name, userIds } of historicalSiteMembers.values()) {
    const siteId = stableUuid('site', identityKey(name))
    const teamId = stableUuid('team', identityKey(name))
    const modality = identityKey(name) === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL'
    await prisma.site.upsert({
      where: { id: siteId },
      update: { name, active: true },
      create: { id: siteId, name, active: true }
    })
    await prisma.team.upsert({
      where: { id: teamId },
      update: { name: `Equipo ${name}`, siteId, modality },
      create: { id: teamId, name: `Equipo ${name}`, siteId, modality }
    })
    for (const userId of userIds) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId } },
        update: {},
        create: { id: stableUuid('team-member', `${teamId}:${userId}`), teamId, userId }
      })
      teamMemberships += 1
    }
  }

  for (const source of sourceReceipts) {
    const sourceId = requiredText(source.id, 'recibos.id')
    const contractId = contractIds.get(requiredText(source.contrato_id, `contrato_id del recibo ${sourceId}`))
    const userId = userIds.get(requiredText(source.usuario_id, `usuario_id del recibo ${sourceId}`))
    if (!contractId || !userId) throw new Error(`El recibo ${sourceId} no tiene una matrícula o usuario asociado.`)
    const receiptData = {
      contractId,
      userId,
      registeredRole: text(source.rol_registro),
      amount: decimal(source.cuota_inicial),
      concepts: text(source.conceptos),
      otherConcept: text(source.otros_concepto),
      paymentMethod: text(source.forma_pago),
      operationNumber: text(source.nro_operacion),
      bank: text(source.banco),
      transactionDate: date(source.fecha_transaccion),
      registeredAt: date(source.fecha_registro) ?? new Date()
    }
    const id = stableUuid('receipt', sourceId)
    await prisma.receipt.upsert({ where: { id }, update: receiptData, create: { id, ...receiptData } })
  }

  console.log(`Migración completada: ${sourceUsers.length} usuarios, ${strategyNames.length} estrategias, ${customerIds.size} perfiles de cliente, ${sourceContracts.length} matrículas, ${studentLinks} relaciones matrícula-alumno, ${historicalSiteMembers.size} sedes, ${teamMemberships} miembros de equipos y ${sourceReceipts.length} recibos procesados.`)
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
