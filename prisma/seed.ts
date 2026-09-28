import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dumpPath = resolve(process.cwd(), 'backup_database.sql')

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

function decodeCopyField(value: string): unknown {
  if (value === '\\N') return null
  let decoded = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character !== '\\' || index + 1 >= value.length) {
      decoded += character
      continue
    }

    const escaped = value[++index]
    const simpleEscapes: Record<string, string> = {
      b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\'
    }
    if (escaped in simpleEscapes) {
      decoded += simpleEscapes[escaped]
    } else if (/[0-7]/.test(escaped)) {
      let octal = escaped
      while (octal.length < 3 && index + 1 < value.length && /[0-7]/.test(value[index + 1])) octal += value[++index]
      decoded += String.fromCharCode(Number.parseInt(octal, 8))
    } else if (escaped === 'x' && /[\da-f]/i.test(value[index + 1] || '')) {
      let hex = ''
      while (hex.length < 2 && index + 1 < value.length && /[\da-f]/i.test(value[index + 1])) hex += value[++index]
      decoded += String.fromCharCode(Number.parseInt(hex, 16))
    } else {
      decoded += escaped
    }
  }
  return decoded
}

function parseCopyRows(sql: string, table: string): SqlRow[] {
  const header = new RegExp(`^COPY public\\.${table} \\(([^\\n]*)\\) FROM stdin;$`, 'm')
  const match = header.exec(sql)
  if (!match || match.index === undefined) throw new Error(`No se encontró COPY public.${table} en ${dumpPath}`)
  const columns = match[1].split(', ').map((column) => column.trim())
  const start = match.index + match[0].length + 1
  const end = sql.indexOf('\n\\.', start)
  if (end < 0) throw new Error(`La sección COPY de public.${table} está incompleta`)
  const lines = sql.slice(start, end).split('\n').filter(Boolean)
  return lines.map((line) => {
    const values = line.replace(/\r$/, '').split('\t')
    if (values.length !== columns.length) {
      throw new Error(`Fila inválida en ${table}: esperaba ${columns.length} valores y recibió ${values.length}`)
    }
    return Object.fromEntries(columns.map((column, index) => [column, decodeCopyField(values[index])]))
  })
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
  const sourceRoles = parseCopyRows(sql, 'roles')
  const sourceUsers = parseCopyRows(sql, 'users')
  const sourceContracts = parseCopyRows(sql, 'contratos')
  const sourceReceipts = parseCopyRows(sql, 'recibos')
  if (!sourceUsers.length || !sourceContracts.length) throw new Error(`El dump no contiene usuarios y matrículas: ${dumpPath}`)

  // Check all source foreign keys before touching the target database.
  const sourceRoleIds = new Set(sourceRoles.map((row) => requiredText(row.id, 'roles.id')))
  const sourceUserIds = new Set(sourceUsers.map((row) => requiredText(row.id, 'users.id')))
  const sourceContractIds = new Set(sourceContracts.map((row) => requiredText(row.id, 'contratos.id')))
  const invalidUserRoles = sourceUsers.filter((row) => !sourceRoleIds.has(requiredText(row.role_id, `role_id de ${String(row.username)}`)))
  const invalidContractUsers = sourceContracts.filter((row) => !sourceUserIds.has(requiredText(row.usuario_id, `usuario_id de ${String(row.nro_contrato)}`)))
  const invalidReceiptContracts = sourceReceipts.filter((row) => !sourceContractIds.has(requiredText(row.contrato_id, `contrato_id del recibo ${String(row.id)}`)))
  const invalidReceiptUsers = sourceReceipts.filter((row) => !sourceUserIds.has(requiredText(row.usuario_id, `usuario_id del recibo ${String(row.id)}`)))
  if (invalidUserRoles.length || invalidContractUsers.length || invalidReceiptContracts.length || invalidReceiptUsers.length) {
    throw new Error([
      'El dump contiene relaciones incompletas y no se importará parcialmente.',
      invalidUserRoles.length ? `Usuarios con rol inexistente: ${invalidUserRoles.map((row) => String(row.id)).join(', ')}` : '',
      invalidContractUsers.length ? `Matrículas sin asesor: ${invalidContractUsers.map((row) => String(row.id)).join(', ')}` : '',
      invalidReceiptContracts.length ? `Recibos sin matrícula: ${invalidReceiptContracts.map((row) => String(row.id)).join(', ')}` : '',
      invalidReceiptUsers.length ? `Recibos sin registrador: ${invalidReceiptUsers.map((row) => String(row.id)).join(', ')}` : ''
    ].filter(Boolean).join('\n'))
  }

  const roleIds = new Map<string, string>()
  for (const source of sourceRoles) {
    const sourceId = requiredText(source.id, 'roles.id')
    const name = requiredText(source.name, `name del rol ${sourceId}`)
    const roleData = {
      name,
      permissions: json(source.permissions),
      createdAt: date(source.created_at) ?? new Date()
    }
    const role = await prisma.role.upsert({
      where: { name },
      update: roleData,
      create: { id: sourceId, ...roleData }
    })
    roleIds.set(sourceId, role.id)
  }

  const userIds = new Map<string, string>()
  for (const source of sourceUsers) {
    const sourceId = requiredText(source.id, 'users.id')
    const username = requiredText(source.username, `username del usuario ${sourceId}`)
    const roleId = roleIds.get(requiredText(source.role_id, `role_id de ${username}`))
    if (!roleId) throw new Error(`No se pudo resolver el rol del usuario ${username}`)
    const existing = await prisma.user.findUnique({ where: { username } })
    const id = existing?.id ?? sourceId
    const userData = {
      username,
      email: requiredText(source.email, `email de ${username}`),
      password: requiredText(source.password, `password de ${username}`),
      name: requiredText(source.name, `name de ${username}`),
      picUser: text(source.pic_user),
      active: boolean(source.active),
      emailVerified: boolean(source.email_verified),
      roleId,
      createdAt: date(source.created_at) ?? new Date(),
      updatedAt: date(source.updated_at) ?? new Date()
    }
    await prisma.user.upsert({ where: { id }, update: userData, create: { id, ...userData } })
    userIds.set(sourceId, id)
  }

  const contractIds = new Map<string, string>()
  const customerIds = new Set<string>()
  let studentLinks = 0
  for (const source of sourceContracts) {
    const sourceId = requiredText(source.id, 'contratos.id')
    const userId = userIds.get(requiredText(source.usuario_id, `usuario_id de ${sourceId}`))
    if (!userId) throw new Error(`La matrícula ${sourceId} referencia a un asesor inexistente.`)
    const contractNumber = requiredText(source.nro_contrato, `nro_contrato(${sourceId})`)
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
    const id = existingContract?.id ?? sourceId
    const contractData = {
      userId,
      customerId,
      registeredAt: date(source.fecha_registro) ?? new Date(),
      contractDepartment: text(source.contrato_dep),
      contractProvince: text(source.contrato_prov),
      contractDistrict: text(source.contrato_dist),
      contractNumber,
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
      status: text(source.estado),
      accepted: boolean(source.acepto),
      createdAt: date(source.created_at) ?? new Date(),
      updatedAt: date(source.updated_at) ?? new Date(),
      acceptedAt: date(source.acepto_fecha),
      acceptedIp: text(source.acepto_ip),
      accessToken: text(source.access_token),
      tokenExpiresAt: date(source.token_expiration)
    }
    await prisma.contract.upsert({ where: { id }, update: contractData, create: { id, ...contractData } })
    contractIds.set(sourceId, id)

    const otherData = {
      currentSituation: requiredText(source.situacion_actual, `situacion_actual(${sourceId})`),
      housingType: requiredText(source.tipo_vivienda, `tipo_vivienda(${sourceId})`),
      dataAuthorization: boolean(source.autorizacion_datos),
      strategy: requiredText(source.estrategia, `estrategia(${sourceId})`),
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
          throw new Error(`Beneficiario ${slot} de la matrícula ${sourceId} tiene datos, pero no nombre.`)
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
    await prisma.receipt.upsert({ where: { id: sourceId }, update: receiptData, create: { id: sourceId, ...receiptData } })
  }

  console.log(`Migración completada: ${sourceUsers.length} usuarios, ${customerIds.size} perfiles de cliente, ${sourceContracts.length} matrículas, ${studentLinks} relaciones matrícula-alumno y ${sourceReceipts.length} recibos procesados.`)
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
