import { assertCsrf, getUserBySession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const optionalText = (value: unknown) => text(value) || null
const dateValue = (value: unknown) => { const raw = text(value); if (!raw) return null; const date = new Date(`${raw}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? null : date }
const money = (value: unknown) => { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : 0 }

export default defineEventHandler(async (event) => {
  assertCsrf(event)
  const user = await getUserBySession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sesión no válida' })
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID de matrícula inválido' })

  const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true, userId: true, customerId: true, status: true } })
  if (!contract) throw createError({ statusCode: 404, statusMessage: 'Matrícula no encontrada' })
  if (!['admin', 'asesor', 'verificador'].includes(user.role?.name || '')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para editar matrículas' })
  if (user.role?.name === 'asesor' && contract.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a esta matrícula' })
  if (user.role?.name === 'asesor' && Number(contract.status) !== 0) throw createError({ statusCode: 409, statusMessage: 'Los asesores solo pueden editar matrículas en revisión' })

  const body = await readBody<Record<string, unknown>>(event)
  const required = ['contractDepartment', 'contractProvince', 'contractDistrict', 'holderName', 'holderBirthDate', 'holderDni', 'holderEmail', 'holderAddress', 'holderDepartment', 'holderProvince', 'holderDistrict', 'holderPhone', 'strategy', 'modality', 'program', 'paymentMode', 'programValue']
  const missing = required.find((field) => !text(body[field]))
  if (missing) throw createError({ statusCode: 400, statusMessage: `El campo ${missing} es obligatorio.` })
  if (!body.dataAuthorization) throw createError({ statusCode: 400, statusMessage: 'La autorización de datos personales es obligatoria.' })
  if (text(body.program) !== 'Kids' && !text(body.plan)) throw createError({ statusCode: 400, statusMessage: 'El plan es obligatorio para este programa.' })

  const paymentMode = text(body.paymentMode)
  const studentInputs = Array.isArray(body.students)
    ? body.students as Array<Record<string, unknown>>
    : [1, 2].map((number) => ({
        name: body[`beneficiary${number}Name`], birthDate: body[`beneficiary${number}BirthDate`],
        dni: body[`beneficiary${number}Dni`], email: body[`beneficiary${number}Email`], phone: body[`beneficiary${number}Phone`]
      }))
  const students = studentInputs.map((student) => ({
    name: text(student.name), birthDate: dateValue(student.birthDate), dni: optionalText(student.dni),
    email: optionalText(student.email), phone: optionalText(student.phone)
  })).filter((student) => student.name)
  const holder = {
    name: text(body.holderName), birthDate: dateValue(body.holderBirthDate)!, dni: text(body.holderDni),
    email: text(body.holderEmail), address: text(body.holderAddress), department: optionalText(body.holderDepartment),
    province: optionalText(body.holderProvince), district: optionalText(body.holderDistrict), phone: text(body.holderPhone)
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: contract.customerId }, data: holder })
    await tx.contract.update({ where: { id }, data: {
      contractDepartment: text(body.contractDepartment), contractProvince: text(body.contractProvince), contractDistrict: text(body.contractDistrict),
      paymentStartDate: optionalText(body.paymentStartDate), modality: text(body.modality), program: text(body.program),
      plan: text(body.program) === 'Kids' ? null : optionalText(body.plan), cashPayment: paymentMode === 'contado',
      financedPayment: paymentMode === 'financiado', programValue: money(body.programValue), initialPayment: money(body.initialPayment),
      balance: money(body.balance), installmentCount: Math.max(0, Math.trunc(Number(body.installmentCount) || 0)),
      installmentValue: money(body.installmentValue), otherPayment: optionalText(body.otherPayment),
      students: { deleteMany: {} }
    } })
    await tx.contractOtherData.upsert({ where: { contractId: id }, create: {
      contractId: id, currentSituation: text(body.currentSituation) || 'Empleado', housingType: text(body.housingType) || 'Propia',
      strategy: text(body.strategy), notes: optionalText(body.notes), dataAuthorization: Boolean(body.dataAuthorization),
      testimonials: Boolean(body.testimonials), dataUsage: Boolean(body.dataUsage)
    }, update: {
      currentSituation: text(body.currentSituation) || 'Empleado', housingType: text(body.housingType) || 'Propia',
      strategy: text(body.strategy), notes: optionalText(body.notes), dataAuthorization: Boolean(body.dataAuthorization),
      testimonials: Boolean(body.testimonials), dataUsage: Boolean(body.dataUsage)
    } })
    const seen = new Set<string>()
    for (const student of students) {
      const existing = student.dni ? await tx.student.findFirst({ where: { customerId: contract.customerId, dni: student.dni } }) : null
      const saved = existing
        ? await tx.student.update({ where: { id: existing.id }, data: student, select: { id: true } })
        : await tx.student.create({ data: { customerId: contract.customerId, ...student }, select: { id: true } })
      if (!seen.has(saved.id)) {
        await tx.contractStudent.create({ data: { contractId: id, studentId: saved.id } })
        seen.add(saved.id)
      }
    }
  })
  return { success: true, message: 'Matrícula actualizada correctamente' }
})
